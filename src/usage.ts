import type { PositionalArgument, QuestionList } from './types.ts';

type Detail = {
  name: string;
  type?: string;
  description: string;
  choices?: string;
  default?: string;
};

export function usage({
  name,
  description,
  positionals,
  questions,
  stdout,
}: {
  name: string;
  description?: string;
  positionals: PositionalArgument[];
  questions: QuestionList<string>;
  stdout: NodeJS.WriteStream;
}): void {
  let text = '';

  const positionalsString =
    positionals.length > 0 ? ` ${positionals.join(' ')}` : '';

  text += `Usage: ${name}${positionalsString}\n\n`;

  if (description != null) {
    text += `${description}\n\n`;
  }

  const startup: Detail[] = [
    {
      name: '-v, --version',
      description: 'Print the version number and exit',
    },
    {
      name: '-h, --help',
      description: 'Show this help message and exit',
    },
  ];

  const options = Object.entries(questions).map(([key, question]): Detail => {
    let type;

    if ('type' in question) {
      switch (question.type) {
        case 'text':
          type = 'string';
          break;
        case 'select':
          type = 'string';
          break;
        case 'multiselect':
          type = 'array';
          break;
        case 'confirm':
          type = 'boolean';
          break;
        case 'task':
          break;
        default:
          // exhaustive check
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw question satisfies never;
      }
    }

    return {
      name: `${question.alias != null ? `-${question.alias}, ` : '    '}--${camelToKebabCase(key)}`,
      type: type != null ? `[${type}]` : undefined,
      description: question.description,
      choices:
        'choices' in question
          ? question.choices.map((choice) => `'${choice.value}'`).join(', ')
          : undefined,
      default:
        'default' in question &&
        question.default != null &&
        typeof question.default !== 'function'
          ? Array.isArray(question.default)
            ? question.default.map((v) => `'${v}'`).join(', ')
            : String(question.default)
          : undefined,
    };
  });

  const table = [
    { title: 'Startup', details: startup },
    { title: 'Options', details: options },
  ];

  const maxOptionLength = Math.max(
    ...table
      .map((item) => item.details.map((detail) => detail.name.length))
      .flat()
  );

  const maxTypeLength = Math.max(
    ...table
      .map((item) =>
        item.details.map((detail) =>
          typeof detail.type === 'string' ? detail.type.length : 0
        )
      )
      .flat()
  );

  for (const { title, details } of table) {
    text += `${title}:\n`;

    for (const detail of details) {
      const separator = '  ';

      const nameWithPadding = `  ${detail.name}${' '.repeat(
        maxOptionLength - detail.name.length
      )}`;

      const typeString = detail.type != null ? detail.type : '';
      const typeWithPadding = `${typeString}${' '.repeat(
        maxTypeLength - typeString.length
      )}`;

      const option = [nameWithPadding, typeWithPadding].join(separator);

      text += `${option}${separator}${detail.description}\n`;

      const choicesText =
        detail.choices != null ? `choices: ${detail.choices}` : '';
      const defaultText =
        detail.default != null ? `default: ${detail.default}` : '';

      const additionalInfo = [choicesText, defaultText]
        .filter(Boolean)
        .join(', ');

      if (additionalInfo.length > 0) {
        const padding = ' '.repeat(option.length);

        text += `${padding}${separator}(${additionalInfo})\n`;
      }
    }

    if (title !== table.at(-1)?.title) {
      text += '\n';
    }
  }

  stdout.write(text);
}

export function camelToKebabCase(text: string): string {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}
