import ansiEscapes from 'ansi-escapes';
import * as components from './components.ts';
import { KEYCODES } from './constants.ts';
import { render } from './render.ts';
import type {
  ConfirmQuestion,
  MultiSelectQuestion,
  SelectChoice,
  SelectQuestion,
} from './types.ts';

export type QuestionOptions = {
  stdin: NodeJS.ReadStream;
  stdout: NodeJS.WriteStream;
  onCancel: () => void;
};

export async function select<
  T extends
    | SelectQuestion<SelectChoice>
    | MultiSelectQuestion<SelectChoice>
    | ConfirmQuestion,
  R = T extends SelectQuestion<infer Choice>
    ? Choice['value']
    : T extends MultiSelectQuestion<infer Choice>
      ? Choice
      : T extends ConfirmQuestion
        ? boolean
        : never,
>(question: T, { stdin, stdout, onCancel }: QuestionOptions): Promise<R> {
  const message = question.message;
  const type = question.type === 'confirm' ? 'select' : question.type;
  const choices =
    question.type === 'confirm'
      ? [
          { title: 'Yes', value: true },
          { title: 'No', value: false },
        ]
      : question.choices;

  // Don't prompt if there's only one choice
  if (choices.length === 1 && type === 'select') {
    const choice = choices[0];

    if (choice != null) {
      // @ts-expect-error: typescript can't properly infer the type
      return choice.value;
    }
  }

  const defaultValue: unknown =
    typeof question.default === 'function'
      ? // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        await question.default()
      : question.default;

  let index =
    type === 'multiselect'
      ? 0
      : question.default != null
        ? choices.findIndex((c) => c.value === defaultValue)
        : 0;

  let selected: unknown[] =
    type === 'multiselect' && Array.isArray(defaultValue) ? defaultValue : [];

  let validation: string | boolean = true;

  const getText = (answered: boolean, cancelled?: boolean) => {
    const status =
      cancelled === true ? 'cancelled' : answered ? 'done' : 'pending';

    const text =
      question.type === 'confirm'
        ? components.confirm({
            message,
            choices,
            index,
            status,
          })
        : question.type === 'multiselect'
          ? components.multiselect({
              message,
              choices,
              index,
              answer: selected,
              status,
            })
          : components.select({
              message,
              choices,
              index,
              status,
            });

    const error = validation !== true ? components.error({ validation }) : null;

    return `${text}${error != null && error.length ? `\n${error}` : ''}`;
  };

  stdout.write(ansiEscapes.cursorHide);

  // Get cursor position BEFORE rendering to calculate mouse click offsets
  let startY = 0;
  const getCursorPosition = new Promise<void>((resolve) => {
    const onResponse = (data: Buffer) => {
      const response = data.toString();
      // CPR response format: ESC[row;colR
      // eslint-disable-next-line no-control-regex
      const match = response.match(/\x1b\[(\d+);(\d+)R/);
      if (match && match[1] != null) {
        startY = parseInt(match[1], 10);
        stdin.off('data', onResponse);
        resolve();
      }
    };

    stdin.on('data', onResponse);
    // Request cursor position (CPR - Cursor Position Report)
    stdout.write('\x1b[6n');

    // Fallback timeout
    setTimeout(() => {
      stdin.off('data', onResponse);
      resolve();
    }, 100);
  });

  await getCursorPosition;

  const { update, rerender } = render(getText(false), stdout);

  let removeListeners: (() => void) | undefined;

  // Enable mouse tracking
  stdout.write('\x1b[?1000h'); // Enable mouse button tracking
  stdout.write('\x1b[?1002h'); // Enable mouse button and motion tracking
  stdout.write('\x1b[?1015h'); // Enable urxvt extended mouse mode
  stdout.write('\x1b[?1006h'); // Enable SGR extended mouse mode

  const result = await new Promise<R>((resolve, reject) => {
    const disableMouseTracking = () => {
      stdout.write('\x1b[?1000l'); // Disable mouse button tracking
      stdout.write('\x1b[?1002l'); // Disable mouse button and motion tracking
      stdout.write('\x1b[?1015l'); // Disable urxvt extended mouse mode
      stdout.write('\x1b[?1006l'); // Disable SGR extended mouse mode
    };

    const onKeyPress = (data: Buffer) => {
      const key = data.toString();

      // Parse mouse events (SGR format: \x1b[<button;x;y;M or m)
      // eslint-disable-next-line no-control-regex
      const mouseMatch = key.match(/\x1b\[<(\d+);(\d+);(\d+)([Mm])/);
      if (mouseMatch) {
        const button = mouseMatch[1];
        const y = mouseMatch[3];
        const action = mouseMatch[4];

        // Only handle left click (button 0) on mouse down (M)
        if (button === '0' && action === 'M' && y != null) {
          const clickY = parseInt(y, 10);

          // Calculate the relative line from the start of our prompt
          // startY is where the first line of text was rendered
          // clickY is the absolute position in the terminal
          const relativeY = clickY - startY;

          // First line (0) is the question, subsequent lines are choices
          // So choice index = relativeY - 1
          const clickedIndex = relativeY - 1;

          if (clickedIndex >= 0 && clickedIndex < choices.length) {
            if (type === 'multiselect') {
              // For multiselect, toggle the clicked choice
              validation = true;
              index = clickedIndex;

              const choice = choices[clickedIndex];
              if (choice !== undefined) {
                if (selected.includes(choice.value)) {
                  selected = selected.filter((c) => c !== choice.value);
                } else {
                  selected.push(choice.value);
                }
              }

              update(getText(false));
            } else {
              // For select, just update the index
              validation = true;
              index = clickedIndex;
              update(getText(false));
            }
          }
        }

        return;
      }

      switch (key) {
        case KEYCODES.ARROW_UP:
        case KEYCODES.ARROW_DOWN:
        case KEYCODES.ARROW_LEFT:
        case KEYCODES.ARROW_RIGHT: {
          validation = true;
          index = Math.min(
            Math.max(
              key === KEYCODES.ARROW_UP || key === KEYCODES.ARROW_LEFT
                ? index - 1
                : index + 1,
              0
            ),
            choices.length - 1
          );

          update(getText(false));

          break;
        }
        case KEYCODES.A: {
          if (type === 'multiselect') {
            validation = true;

            if (selected.length === choices.length) {
              selected = [];
            } else {
              selected = choices.map((c) => c.value);
            }

            update(getText(false));
          }

          break;
        }
        case KEYCODES.SPACE: {
          if (type === 'multiselect') {
            validation = true;

            const choice = choices[index];

            if (choice !== undefined) {
              if (selected.includes(choice.value)) {
                selected = selected.filter((c) => c !== choice.value);
              } else {
                selected.push(choice.value);
              }
            }

            update(getText(false));
          }

          break;
        }
        case KEYCODES.ENTER:
          if (question.validate) {
            validation = question.validate(
              // @ts-expect-error: typescript can't properly infer the type
              type === 'multiselect' ? selected : choices[index]?.value
            );
          }

          if (validation === true) {
            stdin.off('data', onKeyPress);

            update(getText(true));

            disableMouseTracking();
            stdout.write(ansiEscapes.cursorShow);
            stdout.write(`\n`);

            if (type === 'multiselect') {
              // @ts-expect-error: typescript can't properly infer the type
              resolve(selected);
            } else {
              const answer = choices[index];

              if (answer == null) {
                reject(new Error('Invalid answer'));
              } else {
                // @ts-expect-error: typescript can't properly infer the type
                resolve(answer.value);
              }
            }
          } else {
            update(getText(false));
          }

          break;
        case KEYCODES.CONTROL_C: {
          stdin.off('data', onKeyPress);

          update(getText(false, true));

          disableMouseTracking();
          stdout.write(ansiEscapes.cursorShow);
          stdout.write('\n');

          onCancel();

          reject(new Error('User cancelled the prompt'));

          break;
        }
      }
    };

    stdin.on('data', onKeyPress);
    stdout.on('resize', rerender);

    removeListeners = () => {
      stdin.off('data', onKeyPress);
      stdout.off('resize', rerender);
      disableMouseTracking();
    };
  });

  removeListeners?.();

  return result;
}
