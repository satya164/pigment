import ansiEscapes from 'ansi-escapes';
import { createInterface } from 'node:readline/promises';
import * as components from './components.ts';
import { KEYCODES } from './constants.ts';
import { render } from './render.ts';
import type { SelectChoice } from './types.ts';

type QuestionBase = {
  message: string;
  validate?: (value: any) => string | boolean;
};

type QuestionText = QuestionBase;

type QuestionSelect = QuestionBase &
  (
    | {
        type: 'select' | 'multiselect';
        choices: SelectChoice[];
      }
    | {
        type: 'confirm';
        choices?: never;
      }
  );

type QuestionOptions = {
  stdin: NodeJS.ReadStream;
  stdout: NodeJS.WriteStream;
  onCancel: () => void;
};

export async function text(
  { message, validate }: QuestionText,
  { stdin, stdout, onCancel }: QuestionOptions
): Promise<string> {
  const rl = createInterface({
    input: stdin,
    output: stdout,
  });

  rl.on('SIGINT', () => {
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
  let answer = await rl.question(prompt);

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

export async function select<T extends boolean>(
  question: QuestionSelect,
  { stdin, stdout, onCancel }: QuestionOptions
): Promise<T extends true ? SelectChoice['value'][] : SelectChoice['value']> {
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

  let index = 0;
  let selected: unknown[] = [];
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

    stdin.on('data', onKeyPress);
  });
}
