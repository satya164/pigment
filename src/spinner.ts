import ansiEscapes from 'ansi-escapes';
import * as components from './components.ts';
import { KEYCODES } from './constants.ts';
import { render } from './render.ts';
import type { QuestionOptions } from './select.ts';
import type { SpinnerQuestion } from './types.ts';

export async function spinner<T>(
  { message, task }: SpinnerQuestion<T>,
  { stdin, stdout, onCancel }: QuestionOptions
): Promise<unknown> {
  stdout.write(ansiEscapes.cursorHide);

  const props: Parameters<typeof components.spinner>[0] = {
    counter: 0,
    message,
    status: 'pending' as const,
  };

  let result;

  const { update } = render(components.spinner(props), stdout);

  const interval = setInterval(() => {
    props.counter++;

    update(components.spinner(props));
  }, 80);

  const onKeyPress = (data: Buffer) => {
    const key = data.toString();

    if (key === KEYCODES.CONTROL_C) {
      stdin.removeListener('data', onKeyPress);

      clearInterval(interval);

      props.status = 'cancelled';

      update(components.spinner(props));

      stdout.write(ansiEscapes.cursorShow);
      stdout.write('\n');

      onCancel();
    }
  };

  stdin.addListener('data', onKeyPress);

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
    stdin.removeListener('data', onKeyPress);
    stdout.write(ansiEscapes.cursorShow);
  }

  update(
    components.spinner({
      counter: props.counter,
      message: result.message ?? message,
      answer: result.value,
      status: 'done',
    })
  );

  stdout.write('\n');

  return result.value;
}
