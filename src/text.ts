import {
  cursorPrevLine,
  eraseDown,
  eraseEndLine,
  eraseLine,
} from 'ansi-escapes';
import { stripVTControlCharacters, styleText } from 'node:util';
import { createInterface } from 'readline/promises';
import * as components from './components.ts';
import { KEYCODES } from './constants.ts';
import { render } from './render.ts';
import type { QuestionOptions } from './select.ts';
import type { TextQuestion } from './types.ts';

export async function text(
  { message, initial, validate }: TextQuestion,
  { stdin, stdout, onCancel }: QuestionOptions
): Promise<string> {
  const rl = createInterface({
    input: stdin,
    output: stdout,
  });

  rl.once('SIGINT', () => {
    rl.close();

    update(
      components.text({
        message,
        status: 'cancelled',
        answer,
      })
    );

    stdout.write('\n');

    onCancel();
  });

  const text = components.text({
    message,
    status: 'pending',
  });

  if (text.includes('<input>') && !text.includes('<input>\n')) {
    throw new Error(
      `Input placeholder '<input>' must be followed by a newline.`
    );
  }

  const [before = '', after = ''] = text.includes('<input>\n')
    ? text.split('<input>\n')
    : [text, ''];

  const lines = before.split('\n');
  const prompt = lines.pop() ?? '';

  const { update } = render(before, stdout);

  let initialResult = typeof initial === 'function' ? await initial() : initial;
  let validation: string | boolean = true;

  let answer = initialResult;

  const updateFooter = () => {
    const validationText =
      validation !== true ? `${components.error({ validation })}\n` : '';
    const validationLeadingWhitespaceCount =
      validationText.match(/^[\s]+/)?.[0].length ?? 0;

    const lines = [];

    let containsValidation = false;

    // If validation text starts with whitespace, and the prompt footer is smaller,
    // We can merge both for a more compact display
    for (const line of after.split('\n')) {
      const visibleLength = stripVTControlCharacters(line).length;

      if (
        !containsValidation &&
        visibleLength <= validationLeadingWhitespaceCount
      ) {
        lines.push(`${line}${validationText.slice(visibleLength)}`);
        containsValidation = true;
      } else {
        lines.push(line);
      }
    }

    if (!containsValidation) {
      lines.push(validationText);
    }

    const content = lines.join('\n');

    // The cursor position doesn't include pre-filled text as it's not in the input
    // So we need to add the length of the answer to get the correct column
    const col = rl.getCursorPos().cols + (initialResult?.length ?? 0);

    // Write the footer content on the next line
    stdout.cursorTo(0);
    stdout.write(`\n${content}`);

    // Clear everything below
    // Otherwise any previous error messages would remain
    stdout.write(eraseDown);

    // Move back to the prompt position
    stdout.moveCursor(0, -content.split('\n').length);
    stdout.cursorTo(col);
  };

  const onData = (data: Buffer) => {
    const key = data.toString('ascii');

    // Don't do anything if it's confirm
    if (key === KEYCODES.ENTER) {
      return;
    }

    const isArrow =
      key === KEYCODES.ARROW_LEFT ||
      key === KEYCODES.ARROW_RIGHT ||
      key === KEYCODES.ARROW_UP ||
      key === KEYCODES.ARROW_DOWN;

    const isDelete = key === KEYCODES.BACKSPACE || key === KEYCODES.DELETE;

    if (initialResult != null) {
      initialResult = undefined;
      answer = undefined;

      stdout.cursorTo(stripVTControlCharacters(prompt).length);
      stdout.write(eraseEndLine);

      if (!(isArrow || isDelete)) {
        // Write the data to stdout so it's visible in the prompt
        stdout.write(data);
      }
    }

    // Clear validation error when user starts typing
    if (!isArrow) {
      validation = true;

      updateFooter();
    }
  };

  stdin.on('data', onData);

  // Also remove the listener when the prompt is closed
  // So it doesn't affect unrelated prompts
  rl.on('close', () => {
    stdin.off('data', onData);
  });

  while (true) {
    const promise = rl.question(prompt);

    // If there was a validation error, keep the previous answer
    if (validation !== true && answer != null) {
      rl.write(answer);
    }

    // Prefill the input with the initial answer if it exists
    if (initialResult != null) {
      // Use stdout to fake input since the text contains escape codes for styling
      stdout.write(styleText(components.theme.hint, initialResult));
    }

    updateFooter();

    const result = await promise;

    // Only use the result if it's not empty
    // Or the answer is not set from the initial value
    if (answer == null || result !== '') {
      answer = result;
    }

    // eslint-disable-next-line require-atomic-updates
    validation = validate ? validate(answer) : true;

    // Clear the new line added by the question
    stdout.write(`${cursorPrevLine}${eraseLine}`);

    if (validation === true) {
      break;
    }
  }

  rl.close();

  update(
    components.text({
      message,
      status: 'done',
      answer,
    })
  );

  stdout.write('\n');

  return answer;
}
