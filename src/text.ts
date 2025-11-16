import ansiEscapes from 'ansi-escapes';
import type { Key } from 'readline';
import { createInterface } from 'readline/promises';
import { styleText } from 'util';
import * as components from './components.ts';
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

  const lines = text.split('\n');
  const prompt = lines.pop() ?? '';

  const { update } = render(text, stdout);

  const initialResult =
    typeof initial === 'function' ? await initial() : initial;

  let error: string | undefined;
  let answer = initialResult;

  const promise = rl.question(prompt);

  const onKeyPressOnce = (callback: (text: string, key: Key) => void) => {
    stdin.once('keypress', callback);

    const remove = () => {
      stdin.off('keypress', callback);
    };

    // Also remove the listener when the prompt is closed
    // So it doesn't affect unrelated prompts
    rl.once('close', remove);
  };

  if (initialResult != null) {
    stdout.write(styleText(components.theme.hint, initialResult));

    onKeyPressOnce((text, key) => {
      // Clear the initial value from the prompt unless it's a confirm
      if (key.name !== 'return') {
        stdout.cursorTo(prompt.length);
        stdout.write(ansiEscapes.eraseLine);

        if (
          key.name !== 'backspace' &&
          key.name !== 'delete' &&
          key.name !== 'left' &&
          key.name !== 'right' &&
          key.name !== 'up' &&
          key.name !== 'down'
        ) {
          // Write the data to stdout so it's visible in the prompt
          stdout.write(text);
        }

        answer = undefined;
      }
    });
  }

  const result = await promise;

  // Only use the result if it's not empty
  // Or the answer is not set from the initial value
  if (answer == null || result !== '') {
    answer = result;
  }

  while (true) {
    // Clear the line added by the question
    stdout.write(`${ansiEscapes.cursorPrevLine}${ansiEscapes.eraseLine}`);

    if (validate) {
      const validation = validate(answer);

      if (validation === true) {
        break;
      } else {
        const promise = rl.question(prompt);

        // Fill the prompt with the previous answer
        rl.write(answer);

        error = components.error({ validation });

        stdout.write(`\n${error}`);

        stdout.moveCursor(0, -error.split('\n').length);
        stdout.cursorTo(prompt.length + answer.length);

        const errorLines = error.split('\n').length;
        const promptEndPosition = prompt.length + answer.length + 1;

        // Clear validation error on next key press
        onKeyPressOnce((_, key) => {
          if (
            key.name !== 'return' &&
            key.name !== 'backspace' &&
            key.name !== 'delete' &&
            key.name !== 'left' &&
            key.name !== 'right' &&
            key.name !== 'up' &&
            key.name !== 'down'
          ) {
            stdout.moveCursor(0, errorLines);
            stdout.write(ansiEscapes.eraseLines(errorLines));
            stdout.moveCursor(promptEndPosition, -1);
          }
        });

        // eslint-disable-next-line require-atomic-updates
        answer = await promise;

        continue;
      }
    } else {
      break;
    }
  }

  update(
    components.text({
      message,
      status: 'done',
      answer,
    })
  );

  if (error != null && error.length) {
    const count = error.split('\n').length;

    stdout.moveCursor(0, count);
    stdout.write(ansiEscapes.eraseLines(count));
    stdout.moveCursor(0, -count);
  }

  stdout.write('\n');

  rl.close();

  return answer;
}
