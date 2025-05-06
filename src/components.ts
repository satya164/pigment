import { styleText } from 'node:util';

export function text({
  message,
  answer,
  done,
}: {
  message: string;
  answer?: string;
  done: boolean;
}) {
  return `${question({ message, done })}\n  ${answer ? styleText('dim', answer) : ''}`;
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
      `  ${styleText('dim', String(answer))}`,
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
        'dim',
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
  const prefix = active ? styleText('green', `❯ ${icon}`) : `  ${icon}`;

  const title = choice.title != null ? choice.title : String(choice.value);

  return `${prefix} ${active ? styleText('green', title) : title}${choice.description ? `\n    ${styleText('dim', choice.description)}` : ''}`;
}

function question({ message, done }: { message: string; done: boolean }) {
  if (done) {
    return `${styleText(['green'], '✔')} ${message}`;
  } else {
    return `${styleText(['blue'], '?')} ${message}`;
  }
}

export function error({
  validation,
}: {
  validation: boolean | string | undefined;
}) {
  const hint = validation === false ? 'Invalid input' : validation;

  if (hint !== null && hint !== true) {
    return styleText(['red', 'italic'], `  ${hint}`);
  }

  return '';
}
