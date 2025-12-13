import ansiEscapes from 'ansi-escapes';
import { stripVTControlCharacters, styleText } from 'node:util';
import { createInterface } from 'readline/promises';
import * as components from './components.ts';
import { KEYCODES } from './constants.ts';
import { PromptError } from './prompt-error.ts';
import { render } from './render.ts';
import type { QuestionOptions, TextQuestion } from './types.ts';

export async function text(
  question: TextQuestion & {
    prefill: string | undefined;
  },
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
        message: question.message,
        status: 'cancelled',
        answer,
        validation: true,
      })
    );

    stdout.write('\n');

    onCancel();
  });

  const text = components.text({
    message: question.message,
    status: 'pending',
    validation: true,
  });

  if (text.includes('<input>') && !text.includes('<input>\n')) {
    throw new PromptError(
      `Input placeholder '<input>' must be followed by a newline.`
    );
  }

  const [before = ''] = text.includes('<input>\n')
    ? text.split('<input>\n')
    : [text];

  const lines = before.split('\n');
  const prompt = lines.pop() ?? '';

  const { update } = render(before, stdout);

  const defaultValue =
    question.prefill ??
    (typeof question.default === 'function'
      ? await question.default()
      : question.default);

  let initialAnswer = defaultValue;
  let answer = initialAnswer;
  let validation: string | boolean =
    defaultValue != null && question.validate
      ? question.validate(defaultValue)
      : true;

  const updateFooter = () => {
    // Prefill the input with the default answer if it exists
    if (initialAnswer != null) {
      // Use stdout to fake input since the text contains escape codes for styling
      stdout.write(styleText(components.theme.hint, initialAnswer));
    }

    const text = components.text({
      message: question.message,
      status: 'pending',
      validation,
    });

    const [, after = ''] = text.includes('<input>\n')
      ? text.split('<input>\n')
      : [text, ''];

    const content = after;

    // The cursor position doesn't include pre-filled text as it's not in the input
    // So we need to add the length of the answer to get the correct column
    const col = rl.getCursorPos().cols + (initialAnswer?.length ?? 0);

    // Clear everything below first
    // Otherwise any previous error messages would remain
    stdout.write(ansiEscapes.eraseDown);

    // Add a new line to go to the next line
    // Otherwise it won't work correctly when there is no space below
    stdout.cursorTo(0);
    stdout.write(`\n`);

    // Write the content, then move back to the prompt position
    stdout.write(content);
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

    if (initialAnswer != null) {
      initialAnswer = undefined;
      answer = undefined;

      stdout.cursorTo(stripVTControlCharacters(prompt).length);
      stdout.write(ansiEscapes.eraseEndLine);

      if (!(isArrow || isDelete)) {
        // Write the data to stdout so it's visible in the prompt
        stdout.write(data);
      }
    }

    // Clear validation error when user starts typing
    if (!isArrow) {
      validation = true;
    }

    // Toggle initial value when using arrows on empty input
    if (isArrow && rl.line.length === 0) {
      if (key === KEYCODES.ARROW_UP || key === KEYCODES.ARROW_LEFT) {
        initialAnswer = defaultValue;
        answer = initialAnswer;
      } else {
        initialAnswer = undefined;
        answer = undefined;
      }

      validation = true;
    }

    // Always re-draw the footer
    // Otherwise some inputs such as arrows clear anything after the prompt
    updateFooter();
  };

  stdin.on('data', onData);

  // Also remove the listener when the prompt is closed
  // So it doesn't affect unrelated prompts
  rl.on('close', () => {
    stdin.off('data', onData);
  });

  stdout.on('resize', updateFooter);

  while (true) {
    const promise = rl.question(prompt);

    // If there was a validation error, keep the previous answer
    if (validation !== true && answer != null && initialAnswer == null) {
      rl.write(answer);
    }

    updateFooter();

    const result = await promise;

    // Only use the result if it's not empty
    // Or the answer is not set from the default value
    if (answer == null || result !== '') {
      answer = result;
    }

    // eslint-disable-next-line require-atomic-updates
    validation = question.validate ? question.validate(answer) : true;

    if (validation === true && question.required === true && answer === '') {
      validation = false;
    }

    // Clear the new line added by the question
    stdout.write(`${ansiEscapes.cursorPrevLine}${ansiEscapes.eraseLine}`);

    if (validation === true) {
      break;
    }
  }

  rl.close();

  stdin.off('data', onData);
  stdout.off('resize', updateFooter);

  update(
    components.text({
      message: question.message,
      status: 'done',
      answer,
      validation: true,
    })
  );

  stdout.write('\n');

  return answer;
}
