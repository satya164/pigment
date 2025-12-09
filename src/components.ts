import { styleText } from 'node:util';

type Status = 'pending' | 'done' | 'cancelled';

export const theme = {
  message: 'none',
  selected: 'cyan',
  question: 'cyan',
  done: 'green',
  hint: 'gray',
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
  return `${question({ message, status })}\n${border()} ${status !== 'pending' ? styleText(theme.hint, answer ?? '') : `<input>\n${styleText(theme.separator, '└')}`}`;
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
      `${border()} ${styleText(theme.hint, String(answer))}`,
    ].join('\n');
  }

  return `${question({ message, status })}\n  ${choices
    .map((choice, i) => {
      const selected = i === index;
      const title = choice.title ?? String(choice.value);

      if (selected) {
        return styleText(theme.selected, `● ${title}`);
      }

      return `○ ${title}`;
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
      `${border()} ${styleText(theme.hint, String(answer))}`,
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
      `${border()} ${styleText(
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
  const prefix = active ? styleText(theme.selected, `› ${icon}`) : `  ${icon}`;

  const title = choice.title != null ? choice.title : String(choice.value);

  return `${prefix} ${active ? styleText(theme.selected, title) : title}${choice.description != null ? `\n    ${styleText(theme.hint, choice.description)}` : ''}`;
}

function question({ message, status }: { message: string; status: Status }) {
  const format =
    status === 'done'
      ? theme.done
      : status === 'cancelled'
        ? theme.hint
        : theme.question;

  const icon = status === 'done' ? '✔' : status === 'cancelled' ? '◼' : '?';

  return `${border()}\n${styleText(format, icon)} ${styleText(theme.message, message)}`;
}

function border() {
  return styleText(theme.separator, '│');
}

export function error({ validation }: { validation: string | undefined }) {
  if (validation != null) {
    return `  ${styleText(theme.error, validation)}`;
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
    return `${border()}\n${styleText(theme.question, frame!)} ${styleText(theme.message, message)}`;
  } else {
    return `${question({ message, status })} ${answer != null ? `\n${border()} ${styleText(theme.hint, typeof answer === 'string' ? answer : `…`)}` : ''}`;
  }
}
