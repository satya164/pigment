import * as readline from 'node:readline/promises';
import { styleText } from 'node:util';
import { KEYCODES } from './constants.ts';
import type { AnswerList, Prompt, QuestionList } from './types.ts';

export function create<const T extends QuestionList<string>>(
  questions: T
): Prompt<T> {
  const context: Record<string, unknown> = {};

  return {
    show: () => show(questions, context),
    read: () => context as Partial<AnswerList<T>>,
  };
}

async function show<const T extends QuestionList<string>>(
  questions: T,
  context: Record<string, unknown> = {}
): Promise<AnswerList<T>> {
  process.stdout.write('\n');

  for (const [key, question] of Object.entries(questions)) {
    const q = typeof question === 'function' ? await question() : question;

    if (q === null) {
      continue;
    }

    switch (q.type) {
      case 'text':
        context[key] = await text(q.message);
        break;
      case 'select':
        context[key] = await select(q.message, q.choices);
        break;
      case 'multiselect':
        context[key] = await text(`${q.message} (${q.choices.join(', ')})`);
        break;
      case 'confirm':
        context[key] = (await text(q.message)) === 'yes';
        break;
    }

    process.stdout.write('\n');
  }

  return context as AnswerList<T>;
}

async function text(message: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const promise = rl.question(`${question(message, false)}\n  `);

  const answer = await promise;

  // Overwrite the previous lines to update the prompt
  clear(2);

  process.stdout.write(
    `${question(message, true)}\n  ${styleText('gray', answer)}\n`
  );

  rl.close();

  return answer;
}

async function select(message: string, choices: string[]): Promise<string> {
  let selected = 0;

  const getText = (answered: boolean) =>
    [
      question(message, answered),
      ...choices.map((choice, i) => {
        const indicator = i === selected ? '●' : '○';
        const prefix = answered
          ? styleText(['gray'], indicator)
          : i === selected
            ? styleText(['green'], indicator)
            : styleText(['white'], indicator);

        return `  ${prefix} ${answered ? styleText('gray', choice) : choice}`;
      }),
    ].join('\n');

  process.stdout.write(KEYCODES.HIDE_CURSOR);
  process.stdout.write(getText(false));

  // Enable raw mode to capture keypresses
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise<string>((resolve, reject) => {
    const onKeyPress = (data: Buffer) => {
      const key = data.toString();

      switch (key) {
        case KEYCODES.ARROW_UP:
        case KEYCODES.ARROW_DOWN: {
          selected = Math.min(
            Math.max(
              key === KEYCODES.ARROW_UP ? selected - 1 : selected + 1,
              0
            ),
            choices.length - 1
          );

          const text = getText(false);

          clear(text.split('\n').length);

          process.stdout.write(`\n${text}`);

          break;
        }
        case KEYCODES.ENTER:
        case KEYCODES.CONTROL_C: {
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onKeyPress);
          process.stdin.pause();

          process.stdout.write(KEYCODES.SHOW_CURSOR);

          if (key === KEYCODES.ENTER) {
            const text = getText(true);

            clear(text.split('\n').length);

            process.stdout.write(`\n${text}\n`);

            const answer = choices[selected];

            if (answer === undefined) {
              reject(new Error('Invalid answer'));
            } else {
              resolve(answer);
            }
          } else {
            process.stdout.write('\n');

            reject(new Error('User cancelled the prompt'));
          }

          break;
        }
      }
    };

    process.stdin.on('data', onKeyPress);
  });
}

function clear(lines: number) {
  process.stdout.write(
    `${Array.from({ length: lines }, () => '\x1b[1A').join('')}\x1b[2K`
  );
}

function question(message: string, answered: boolean) {
  if (answered) {
    return `${styleText(['green'], '✔')} ${message}`;
  } else {
    return `${styleText(['blue'], '?')} ${message}`;
  }
}
