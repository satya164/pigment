import { styleText } from 'node:util';

export const theme = {
  message: 'bold',
  selected: 'cyan',
  question: 'cyan',
  done: 'green',
  hint: 'dim',
  separator: 'gray',
  error: ['red', 'italic'],
} as const satisfies Record<string, Parameters<typeof styleText>[0]>;

export function text({
  message,
  answer,
  done,
}: {
  message: string;
  answer?: string;
  done: boolean;
}) {
  return `${question({ message, done })}\n  ${answer ? styleText(theme.hint, answer) : ''}`;
}

export function confirm({
  message,
  choices,
  index,
  done,
}: {
  message: string;
  choices: { title?: string; value: unknown }[];
  index: number;
  done: boolean;
}) {
  if (done) {
    const answer = choices[index]?.title ?? choices[index]?.value;

    return [
      question({ message, done }),
      `  ${styleText(theme.hint, String(answer))}`,
    ].join('\n');
  }

  return `${question({ message, done })}\n  ${choices
    .map((choice, i) => {
      const selected = i === index;

      if (selected) {
        return styleText(theme.selected, String(choice.title ?? choice.value));
      }

      return choice.title;
    })
    .join(styleText(theme.separator, ' / '))}`;
}

export function select({
  message,
  choices,
  index,
  done,
}: {
  message: string;
  choices: { title?: string; value: unknown }[];
  index: number;
  done: boolean;
}) {
  if (done) {
    const answer = choices[index]?.title ?? choices[index]?.value;

    return [
      question({ message, done }),
      `  ${styleText(theme.hint, String(answer))}`,
    ].join('\n');
  }

  return [
    question({ message, done }),
    ...choices.map((choice, i) => {
      const selected = i === index;

      return checkbox({
        icon: selected ? '●' : '○',
        choice,
        active: selected,
      });
    }),
  ].join('\n');
}

export function multiselect({
  message,
  choices,
  index,
  answer,
  done,
}: {
  message: string;
  choices: { title?: string; value: unknown }[];
  index: number;
  answer: unknown[];
  done: boolean;
}) {
  if (done) {
    return [
      question({ message, done }),
      `  ${styleText(
        theme.hint,
        choices
          .filter((choice) => answer.includes(choice.value))
          .map((choice) => choice.title ?? choice.value)
          .join(', ')
      )}`,
    ].join('\n');
  }

  return [
    question({ message, done }),
    ...choices.map((choice, i) => {
      const selected = answer.includes(choice.value);

      return checkbox({
        icon: selected ? '◼' : '◻',
        choice,
        active: i === index,
      });
    }),
  ].join('\n');
}

function checkbox({
  icon,
  choice,
  active,
}: {
  icon: string;
  choice: { title?: string; description?: string; value: unknown };
  active: boolean;
}) {
  const prefix = active ? styleText(theme.selected, `❯ ${icon}`) : `  ${icon}`;

  const title = choice.title != null ? choice.title : String(choice.value);

  return `${prefix} ${active ? styleText(theme.selected, title) : title}${choice.description ? `\n    ${styleText(theme.hint, choice.description)}` : ''}`;
}

function question({ message, done }: { message: string; done: boolean }) {
  if (done) {
    return `${styleText(theme.done, '✔')} ${styleText(theme.message, message)}`;
  } else {
    return `${styleText(theme.question, '?')} ${styleText(theme.message, message)}`;
  }
}

export function error({
  validation,
}: {
  validation: boolean | string | undefined;
}) {
  const hint = validation === false ? 'Invalid input' : validation;

  if (hint !== null && hint !== true) {
    return styleText(theme.error, `  ${hint}`);
  }

  return '';
}

export function spinner({
  counter,
  message,
  answer,
  done,
}: {
  counter: number;
  message: string;
  answer?: unknown;
  done: boolean;
}) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;

  const index = counter % frames.length;
  const frame = frames[index];

  if (done) {
    return `${styleText(theme.done, '✔')} ${styleText(theme.message, message)} ${answer ? `\n  ${styleText(theme.hint, typeof answer === 'string' ? answer : `…`)}` : ''}`;
  } else {
    return `${styleText(theme.question, frame!)} ${styleText(theme.message, message)}`;
  }
}
