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
>(
  question: T,
  { stdin, stdout, onCancel }: QuestionOptions
): Promise<
  T extends SelectQuestion<infer Choice>
    ? Choice['value']
    : T extends MultiSelectQuestion<infer Choice>
      ? Choice
      : T extends ConfirmQuestion
        ? boolean
        : never
> {
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
      // @ts-expect-error
      return choice.value;
    }
  }

  let index =
    type === 'multiselect'
      ? 0
      : question.initial != null
        ? choices.findIndex((c) => c.value === question.initial)
        : 0;

  let selected: unknown[] =
    type === 'multiselect' && Array.isArray(question.initial)
      ? question.initial
      : [];

  let validation: string | boolean = true;

  const getText = (answered: boolean) => {
    const text =
      question.type === 'confirm'
        ? components.confirm({
            message,
            choices,
            index,
            done: answered,
          })
        : question.type === 'multiselect'
          ? components.multiselect({
              message,
              choices,
              index,
              answer: selected,
              done: answered,
            })
          : components.select({
              message,
              choices,
              index,
              done: answered,
            });

    const error = validation !== true ? components.error({ validation }) : null;

    return `${text}${error ? `\n${error}` : ''}`;
  };

  stdout.write(ansiEscapes.cursorHide);

  const { update } = render(getText(false), stdout);

  return new Promise((resolve, reject) => {
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
              // @ts-expect-error
              type === 'multiselect' ? selected : choices[index]?.value
            );
          }

          if (validation === true) {
            stdin.removeListener('data', onKeyPress);

            update(getText(true));

            stdout.write(ansiEscapes.cursorShow);
            stdout.write(`\n`);

            if (type === 'multiselect') {
              // @ts-expect-error
              resolve(selected);
            } else {
              const answer = choices[index];

              if (answer == null) {
                reject(new Error('Invalid answer'));
              } else {
                // @ts-expect-error
                resolve(answer.value);
              }
            }
          } else {
            update(getText(false));
          }

          break;
        case KEYCODES.CONTROL_C: {
          stdin.removeListener('data', onKeyPress);

          stdout.write(ansiEscapes.cursorShow);
          stdout.write('\n');

          onCancel();

          reject(new Error('User cancelled the prompt'));

          break;
        }
      }
    };

    stdin.addListener('data', onKeyPress);
  });
}
