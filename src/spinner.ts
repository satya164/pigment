import ansiEscapes from 'ansi-escapes';
import * as components from './components.ts';
import { render } from './render.ts';
import type { QuestionOptions } from './select.ts';
import type { SpinnerQuestion } from './types.ts';

export async function spinner<T>(
  { message, task }: SpinnerQuestion<T>,
  { stdout }: QuestionOptions
): Promise<unknown> {
  stdout.write(ansiEscapes.cursorHide);

  const props = {
    counter: 0,
    message,
    done: false,
  };

  let result;

  const { update } = render(components.spinner(props), stdout);

  const interval = setInterval(() => {
    props.counter++;

    update(components.spinner(props));
  }, 80);

  try {
    const generator = task();

    while (true) {
      const { done, value } = await generator.next();

      if (done) {
        result = value;
        break;
      }

      if (value?.message) {
        props.message = value.message;
      }
    }
  } finally {
    clearInterval(interval);
    stdout.write(ansiEscapes.cursorShow);
  }

  update(
    components.spinner({
      counter: props.counter,
      message: result.message ?? message,
      answer: result.value,
      done: true,
    })
  );

  stdout.write('\n');

  return result.value;
}
