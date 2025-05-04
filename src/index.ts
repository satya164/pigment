import type { AnswerList, Prompt, QuestionList } from './types.ts';
import * as readline from 'node:readline/promises';
import { styleText } from 'node:util';

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

  const promise = rl.question(`${styleText(['blue'], '?')} ${message}\n  `);

  const answer = await promise;

  // Overwrite the previous lines to update the prompt
  clear(2);

  process.stdout.write(
    `${styleText(['bold', 'green'], '✔')} ${message}\n  ${styleText('gray', answer)}\n`
  );

  rl.close();

  return answer;
}

async function select(message: string, choices: string[]): Promise<string> {
  let selected = 0;

  const getText = () =>
    [
      `${styleText(['blue'], '?')} ${message}`,
      ...choices.map((choice, i) => {
        const indicator = i === selected ? '●' : '○';
        const prefix =
          i === selected
            ? styleText(['green'], indicator)
            : styleText(['white'], indicator);
        return `  ${prefix} ${choice}`;
      }),
    ].join('\n');

  process.stdout.write(CODES.HIDE_CURSOR);
  process.stdout.write(getText());

  // Handle key presses
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise<string>((resolve, reject) => {
    const onKeyPress = (data: Buffer) => {
      const key = data.toString();

      switch (key) {
        case CODES.ARROW_UP: {
          selected = selected > 0 ? selected - 1 : selected;
          const text = getText();
          clear(text.split('\n').length);
          process.stdout.write(`\n${text}`);
          break;
        }
        case CODES.ARROW_DOWN: {
          selected = selected < choices.length - 1 ? selected + 1 : selected;
          const text = getText();
          clear(text.split('\n').length);
          process.stdout.write(`\n${text}`);
          break;
        }
        case CODES.ENTER: {
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onKeyPress);
          process.stdin.pause();

          // Show cursor again
          process.stdout.write(CODES.HIDE_CURSOR);
          process.stdout.write('\n');

          const answer = choices[selected];

          if (answer === undefined) {
            reject(new Error('Invalid answer'));
          } else {
            resolve(answer);
          }
          break;
        }
        case CODES.CONTROL_C: {
          // Show cursor again before exiting
          process.stdout.write(CODES.HIDE_CURSOR);
          reject(new Error('User cancelled the prompt'));
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

const CODES = {
  ARROW_UP: '\u001B[A',
  ARROW_DOWN: '\u001B[B',
  CONTROL_C: '\u0003',
  ENTER: '\r',
  HIDE_CURSOR: '\x1B[?25l',
} as const;
