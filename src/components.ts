import { formatted } from './formatted.ts';

type Status = 'pending' | 'done' | 'cancelled';

const colored = ({ status }: { status?: Status } = {}) => {
  const styles = {
    s: 'bold',
    i: status === 'done' ? 'green' : status === 'cancelled' ? 'gray' : 'cyan',
    b: 'gray',
    h: 'gray',
    e: 'red',
    r: 'reset',
  } as const;

  return formatted(styles);
};

function question({ message, status }: { message: string; status: Status }) {
  const icon = status === 'done' ? '✔' : status === 'cancelled' ? '◼' : '?';

  return colored({ status })`
%b │
%i ${icon} %s ${message}
`;
}

export function text({
  message,
  answer,
  status,
}: {
  message: string;
  answer?: string;
  status: Status;
}) {
  if (status === 'pending') {
    return colored({ status })`
${question({ message, status })}
%b │ %r <input>
%b └
    `;
  }

  return colored({ status })`
${question({ message, status })}
%b │ %h ${answer ?? ''}
`;
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

    return colored({ status })`
${question({ message, status })}
%b │ %h ${answer}
`;
  }

  const formattedChoices = choices
    .map((choice, i) => {
      const selected = i === index;
      const text = choice.title ?? choice.value;

      if (selected) {
        return colored({ status })`%i ${text}`;
      }

      return text;
    })
    .join(colored({ status })`%b  /  `);

  return colored({ status })`
    ${question({ message, status })}
    ${formattedChoices}
  `;
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

    return colored({ status })`
${question({ message, status })}
%b │ %h ${answer}
`;
  }

  const choicesList = choices
    .map((choice, i) => {
      const selected = i === index;

      return checkbox({
        icon: selected ? '●' : '○',
        choice,
        active: selected,
        status,
      });
    })
    .join('\n');

  return colored({ status })`
    ${question({ message, status })}
    ${choicesList}
  `;
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
    const answerText = choices
      .filter((choice) => answer.includes(choice.value))
      .map((choice) => choice.title ?? choice.value)
      .join(', ');

    return colored({ status })`
${question({ message, status })}
%b │ %h ${answerText}
`;
  }

  const choicesList = choices
    .map((choice, i) => {
      const selected = answer.includes(choice.value);

      return checkbox({
        icon: selected ? '◼' : '◻',
        choice,
        active: i === index,
        status,
      });
    })
    .join('\n');

  return colored({ status })`
    ${question({ message, status })}
    ${choicesList}
  `;
}

function checkbox({
  icon,
  choice,
  active,
  status,
}: {
  icon: string;
  choice: { title?: string; description?: string; value: unknown };
  active: boolean;
  status: Status;
}) {
  const title = choice.title != null ? choice.title : String(choice.value);

  if (active) {
    if (choice.description != null) {
      return colored({ status })`%i › ${icon} ${title}
    %h ${choice.description}`;
    }
    return colored({ status })`%i › ${icon} ${title}`;
  }

  if (choice.description != null) {
    return colored({ status })`%r   ${icon} ${title}
    %h ${choice.description}`;
  }

  return colored({ status })`%r   ${icon} ${title}`;
}

export function error({
  validation,
}: {
  validation: boolean | string | undefined;
}) {
  const hint = validation === false ? 'Invalid input' : validation;

  if (hint != null && hint !== true) {
    return colored()`
%e ${hint}
`;
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
    return colored({ status })`
%b │
%i ${frame} %s ${message}
`;
  }

  if (answer != null) {
    const answerText = typeof answer === 'string' ? answer : '…';

    return colored({ status })`
${question({ message, status })}
%b │ %h ${answerText}
    `;
  }

  return question({ message, status });
}
