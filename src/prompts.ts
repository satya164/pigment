import ansiEscapes from 'ansi-escapes';
import { createInterface } from 'node:readline/promises';
import { styleText } from 'node:util';
import * as components from './components.ts';
import { KEYCODES } from './constants.ts';
import { render } from './render.ts';
import type {
  ConfirmQuestion,
  MultiSelectQuestion,
  SelectChoice,
  SelectQuestion,
  TextQuestion,
} from './types.ts';

type QuestionOptions = {
  stdin: NodeJS.ReadStream;
  stdout: NodeJS.WriteStream;
  onCancel: () => void;
};

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
              stdout.write('\n');

              // @ts-expect-error
              resolve(selected);
            } else {
              const answer = choices[index];

              if (answer == null) {
                reject(new Error('Invalid answer'));
              } else {
                stdout.write('\n');

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
          stdout.write('\n\n');

          onCancel();

          reject(new Error('User cancelled the prompt'));

          break;
        }
      }
    };

    stdin.addListener('data', onKeyPress);
  });
}
