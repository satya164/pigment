import { styleText } from 'node:util';

type Status = 'pending' | 'done' | 'cancelled';

export const theme = {
  message: 'bold',
  selected: 'cyan',
  question: 'cyan',
  done: 'green',
  hint: 'dim',
  separator: 'gray',
  error: 'red',
} as const satisfies Record<string, Parameters<typeof styleText>[0]>;

export function text({
  message,
  answer,
  status,
}: {
  message: string;
  answer?: string;
  status: Status;
}) {
  return `${question({ message, status })}\n  ${answer ? styleText(theme.hint, answer) : ''}`;
}

export function confirm({
  message,
  choices,
  index,
  status,
}: {
  message: string;
  choices: { title?: string; value: unknown }[];
  index: number;
  status: Status;
}) {
  if (status === 'done') {
    const answer = choices[index]?.title ?? choices[index]?.value;

    return [
      question({ message, status }),
      `  ${styleText(theme.hint, String(answer))}`,
    ].join('\n');
  }

  return `${question({ message, status })}\n  ${choices
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
  status,
}: {
  message: string;
  choices: { title?: string; value: unknown }[];
  index: number;
  status: Status;
}) {
  if (status === 'done') {
    const answer = choices[index]?.title ?? choices[index]?.value;

    return [
      question({ message, status }),
      `  ${styleText(theme.hint, String(answer))}`,
    ].join('\n');
  }

  return [
    question({ message, status }),
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
  status,
}: {
  message: string;
  choices: { title?: string; value: unknown }[];
  index: number;
  answer: unknown[];
  status: Status;
}) {
  if (status === 'done') {
    return [
      question({ message, status }),
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
    question({ message, status }),
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

function question({ message, status }: { message: string; status: Status }) {
  const format =
    status === 'done'
      ? theme.done
      : status === 'cancelled'
        ? theme.hint
        : theme.question;

  const icon = status === 'done' ? '✔' : status === 'cancelled' ? '◼' : '?';

  return `${styleText(format, icon)} ${styleText(theme.message, message)}`;
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
  status,
}: {
  counter: number;
  message: string;
  answer?: unknown;
  status: Status;
}) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;

  const index = counter % frames.length;
  const frame = frames[index];

  if (status === 'pending') {
    return `${styleText(theme.question, frame!)} ${styleText(theme.message, message)}`;
  } else {
    return `${question({ message, status })} ${answer ? `\n  ${styleText(theme.hint, typeof answer === 'string' ? answer : `…`)}` : ''}`;
  }
}
