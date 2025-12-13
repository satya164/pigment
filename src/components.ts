import { styleText } from 'node:util';

type Status = 'pending' | 'done' | 'cancelled';

export const theme = {
  message: 'reset',
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
  validation,
}: {
  message: string;
  answer?: string;
  status: Status;
  validation: string | boolean;
}) {
  const errorText = error({ validation, message: 'Invalid input' });

  return `${question({ message, status })}\n${border()} ${status !== 'pending' ? styleText(theme.hint, answer ?? '') : `<input>\n${styleText(theme.separator, '└')}${errorText ? ` ${errorText}` : ''}`}`;
}

export function confirm({
  message,
  choices,
  index,
  status,
  validation,
}: {
  message: string;
  choices: { title?: string; value: unknown }[];
  index: number;
  status: Status;
  validation: string | boolean;
}) {
  if (status === 'done') {
    const answer = choices[index]?.title ?? choices[index]?.value;

    return [
      question({ message, status }),
      `${border()} ${styleText(theme.hint, String(answer))}`,
    ].join('\n');
  }

  const errorText = error({ validation, message: 'Invalid choice' });

  return [
    `${question({ message, status })}\n  ${choices
      .map((choice, i) => {
        const selected = i === index;
        const title = choice.title ?? String(choice.value);

        if (selected) {
          return styleText(theme.selected, `● ${title}`);
        }

        return `○ ${title}`;
      })
      .join(styleText(theme.separator, ' / '))}`,
    ...(errorText ? [`  ${errorText}`] : []),
  ].join('\n');
}

export function select({
  message,
  choices,
  index,
  status,
  validation,
}: {
  message: string;
  choices: { title?: string; value: unknown }[];
  index: number;
  status: Status;
  validation: string | boolean;
}) {
  if (status === 'done') {
    const answer = choices[index]?.title ?? choices[index]?.value;

    return [
      question({ message, status }),
      `${border()} ${styleText(theme.hint, String(answer))}`,
    ].join('\n');
  }

  const errorText = error({ validation, message: 'Invalid selection' });

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
    ...(errorText ? [`  ${errorText}`] : []),
  ].join('\n');
}

export function multiselect({
  message,
  choices,
  index,
  answer,
  status,
  validation,
}: {
  message: string;
  choices: { title?: string; value: unknown }[];
  index: number;
  answer: unknown[];
  status: Status;
  validation: string | boolean;
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

  const errorText = error({ validation, message: 'Invalid selection' });

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
    ...(errorText ? [`  ${errorText}`] : []),
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

function error({
  validation,
  message,
}: {
  validation: string | boolean;
  message: string;
}) {
  if (validation !== true) {
    return styleText(
      theme.error,
      typeof validation === 'string' ? validation : message
    );
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
