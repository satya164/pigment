import * as readline from 'node:readline/promises';
import { styleText } from 'node:util';
import { SEQUENCE } from './constants.ts';
import type { SelectChoice } from './types.ts';

type QuestionOptions = {
  stdin: NodeJS.ReadStream;
  stdout: NodeJS.WriteStream;
  onCancel: () => void;
};

export async function text(
  message: string,
  { stdin, stdout }: QuestionOptions
): Promise<string> {
  const rl = readline.createInterface({
    input: stdin,
    output: stdout,
  });

  const { update } = section(`${question(message, false)}\n`, stdout);

  const answer = await rl.question('  ');

  // Move up to clear new line added after confirmation
  stdout.write(SEQUENCE.LINE_UP);

  update(`${question(message, true)}\n  ${styleText('gray', answer)}`);

  rl.close();

  return answer;
}

export async function select<T extends boolean>(
  message: string,
  choices: SelectChoice[],
  multiple: T,
  { stdin, stdout, onCancel }: QuestionOptions
): Promise<T extends true ? SelectChoice['value'][] : SelectChoice['value']> {
  // Don't prompt if there's only one choice
  if (choices.length === 1 && !multiple) {
    const choice = choices[0];

    if (choice != null) {
      // @ts-expect-error
      return choice.value;
    }
  }

  let index = 0;
  let selected: unknown[] = [];

  const getText = (answered: boolean) =>
    [
      question(message, answered),
      ...choices.map((choice, i) => {
        const active = multiple ? selected.includes(choice.value) : i === index;

        const indicator = multiple
          ? active
            ? '◼'
            : '◻'
          : active
            ? '●'
            : '○';

        const prefix =
          i != index || answered
            ? styleText(['gray'], indicator)
            : styleText(['green'], indicator);

        const title =
          choice.title != null ? choice.title : String(choice.value);

        return `  ${prefix} ${i != index || answered ? styleText('gray', title) : title}`;
      }),
    ].join('\n');

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
        case SEQUENCE.ARROW_DOWN: {
          index = Math.min(
            Math.max(key === SEQUENCE.ARROW_UP ? index - 1 : index + 1, 0),
            choices.length - 1
          );

          update(getText(false));

          break;
        }
        case SEQUENCE.SPACE: {
          if (multiple) {
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

            if (multiple) {
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

function question(message: string, answered: boolean) {
  if (answered) {
    return `${styleText(['green'], '✔')} ${message}`;
  } else {
    return `${styleText(['blue'], '?')} ${message}`;
  }
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
