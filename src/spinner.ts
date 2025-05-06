import ansiEscapes from 'ansi-escapes';
import * as components from './components.ts';
import { render } from './render.ts';
import type { QuestionOptions } from './select.ts';
import type { SpinnerQuestion } from './types.ts';

export async function spinner<T>(
  { message, task }: SpinnerQuestion<T>,
  { stdout }: QuestionOptions
): Promise<unknown> {
  let counter = 0;

  const { update } = render(
    components.spinner({
      counter,
      message,
      done: false,
    }),
    stdout
  );

  const run = async () => {
    stdout.write(ansiEscapes.cursorHide);

    counter = 0;

    const interval = setInterval(() => {
      counter++;

      update(
        components.spinner({
          counter,
          message,
          done: false,
        })
      );
    }, 80);

    let result;

    try {
      result = await task();
    } finally {
      stdout.write(ansiEscapes.cursorShow);
    }

    clearInterval(interval);

    return result;
  };

  let result = await run();

  update(
    components.spinner({
      counter,
      message: result.message ?? message,
      answer: result.value,
      done: true,
    })
  );

  stdout.write('\n\n');

  return result.value;
}
