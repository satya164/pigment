import ansiEscapes from 'ansi-escapes';
import { createInterface } from 'readline/promises';
import { styleText } from 'util';
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

  rl.addListener('SIGINT', () => {
    rl.close();
    stdout.write('\n\n');
    onCancel();
  });

  const text = components.text({
    message,
    done: false,
  });

  const lines = text.split('\n');
  const prompt = lines.pop() ?? '';

  const { update } = render(text, stdout);

  let error: string | undefined;

  let promise = rl.question(prompt);
  let answer = initial;

  if (initial != null) {
    stdout.write(styleText(components.theme.hint, initial));

    const onKeyPress = async (data: Buffer) => {
      const key = data.toString('ascii');

      // Clear the initial value from the prompt unless it's a confirm
      if (key !== KEYCODES.ENTER) {
        stdout.cursorTo(prompt.length);
        stdout.write(ansiEscapes.eraseLine);

        if (
          key !== KEYCODES.BACKSPACE &&
          key !== KEYCODES.DELETE &&
          key !== KEYCODES.ARROW_LEFT &&
          key !== KEYCODES.ARROW_RIGHT &&
          key !== KEYCODES.ARROW_UP &&
          key !== KEYCODES.ARROW_DOWN
        ) {
          // Write the data to stdout so it's visible in the prompt
          stdout.write(data);
        }

        answer = undefined;

        stdin.removeListener('data', onKeyPress);
      }
    };

    stdin.addListener('data', onKeyPress);

    // Also remove the listener when the prompt is closed
    // So it doesn't affect unrelated prompts
    rl.addListener('close', () => {
      stdin.removeListener('data', onKeyPress);
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
      done: true,
      answer,
    })
  );

  if (error) {
    const count = error.split('\n').length;

    stdout.moveCursor(0, count);
    stdout.write(ansiEscapes.eraseLines(count));
    stdout.moveCursor(0, -count);
  }

  stdout.write('\n\n');

  rl.close();

  return answer;
}
