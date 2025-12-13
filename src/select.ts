import ansiEscapes from 'ansi-escapes';
import * as components from './components.ts';
import { KEYCODES } from './constants.ts';
import { render } from './render.ts';
import type {
  ConfirmQuestion,
  MultiSelectQuestion,
  QuestionOptions,
  SelectChoice,
  SelectQuestion,
} from './types.ts';

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
>(
  question: T & {
    prefill: R | undefined;
  },
  { stdin, stdout, onCancel }: QuestionOptions
): Promise<R> {
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
    question.prefill ??
    (typeof question.default === 'function'
      ? await question.default()
      : question.default);

  let index =
    type === 'multiselect'
      ? 0
      : question.default != null
        ? choices.findIndex((c) => c.value === defaultValue)
        : 0;

  let selected: unknown[] =
    type === 'multiselect' && Array.isArray(defaultValue) ? defaultValue : [];

  let validation: string | boolean =
    defaultValue != null && question.validate
      ? question.validate(
          // @ts-expect-error: typescript can't properly infer the type
          type === 'multiselect' ? selected : choices[index]?.value
        )
      : true;

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
            validation,
          })
        : question.type === 'multiselect'
          ? components.multiselect({
              message,
              choices,
              index,
              answer: selected,
              status,
              validation,
            })
          : components.select({
              message,
              choices,
              index,
              status,
              validation,
            });

    return text;
  };

  stdout.write(ansiEscapes.cursorHide);

  const { update, rerender } = render(getText(false), stdout);

  let removeListeners: (() => void) | undefined;

  const cleanup = () => {
    stdout.write(ansiEscapes.cursorShow);
    removeListeners?.();
  };

  const promise = new Promise<R>((resolve, reject) => {
    const onKeyPress = (data: Buffer) => {
      const key = data.toString();

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
        case 'y':
        case 'Y':
        case 'n':
        case 'N': {
          if (question.type === 'confirm') {
            index = choices.findIndex(
              (c) => c.value === (key.toLowerCase() === 'y')
            );
            update(getText(false));
          }
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

          stdout.write('\n');

          cleanup();
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
    };
  });

  try {
    const result = await promise;

    return result;
  } finally {
    cleanup();
  }
}
