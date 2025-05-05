import { createInterface } from 'node:readline/promises';
import * as components from './components.ts';
import { SEQUENCE } from './constants.ts';
import type { SelectChoice } from './types.ts';

type QuestionBase = {
  message: string;
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
  { message }: QuestionText,
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

  const { update } = section(text, stdout);

  const answer = await rl.question(text.split('\n').pop() ?? '');

  // Clear the line added by the question
  stdout.write(`${SEQUENCE.LINE_UP}${SEQUENCE.LINE_CLEAR}`);

  update(
    components.text({
      message,
      done: true,
      answer,
    })
  );

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

  const getText = (answered: boolean) =>
    type === 'multiselect'
      ? components.multiselect({
          message,
          choices,
          done: answered,
          index,
          answer: selected,
        })
      : components.select({
          message,
          choices,
          done: answered,
          index,
        });

  stdout.write(SEQUENCE.CURSOR_HIDE);

  const { update } = section(getText(false), stdout);

  // Enable raw mode to capture keypresses
  stdin.setRawMode(true);
  stdin.resume();

  return new Promise((resolve, reject) => {
    const onKeyPress = (data: Buffer) => {
      const key = data.toString();

      switch (key) {
        case SEQUENCE.ARROW_UP:
        case SEQUENCE.ARROW_DOWN:
        case SEQUENCE.ARROW_LEFT:
        case SEQUENCE.ARROW_RIGHT: {
          index = Math.min(
            Math.max(
              key === SEQUENCE.ARROW_UP || key === SEQUENCE.ARROW_LEFT
                ? index - 1
                : index + 1,
              0
            ),
            choices.length - 1
          );

          update(getText(false));

          break;
        }
        case SEQUENCE.SPACE: {
          if (type === 'multiselect') {
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
        case SEQUENCE.ENTER:
        case SEQUENCE.CONTROL_C: {
          stdin.setRawMode(false);
          stdin.removeListener('data', onKeyPress);
          stdin.pause();

          stdout.write(SEQUENCE.CURSOR_SHOW);

          if (key === SEQUENCE.ENTER) {
            update(getText(true));

            stdout.write(`\n`);

            if (type === 'multiselect') {
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
            stdout.write('\n\n');

            onCancel();

            reject(new Error('User cancelled the prompt'));
          }

          break;
        }
      }
    };

    stdin.on('data', onKeyPress);
  });
}

function section(message: string, stdout: NodeJS.WriteStream) {
  stdout.write(message);

  let previous = message;

  const clear = () => {
    const lines = previous.split('\n');

    stdout.write('\n');
    stdout.write(
      lines.map(() => `${SEQUENCE.LINE_UP}${SEQUENCE.LINE_CLEAR}`).join('')
    );
  };

  const update = (text: string) => {
    clear();

    stdout.write(text);

    previous = text;
  };

  return {
    update,
    clear,
  };
}
