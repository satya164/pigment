import { parseArgs } from './args.ts';
import { select } from './select.ts';
import { spinner } from './spinner.ts';
import { text } from './text.ts';
import type {
  AnswerList,
  Prompt,
  PromptOptions,
  QuestionList,
} from './types.ts';

export function create<const T extends QuestionList<string>>(
  command: string,
  questions: T
): Prompt<T> {
  const context: Partial<AnswerList<T>> = {};

  return {
    show: async (options) => show(command, questions, context, options),
    read: () => context,
  };
}

async function show<const T extends QuestionList<string>>(
  command: string,
  questions: T,
  context: Record<string, unknown>,
  {
    args = process.argv.slice(2),
    stdin = process.stdin,
    stdout = process.stdout,
    interactive = stdout.isTTY &&
      process.env.TERM !== 'dumb' &&
      (process.env.CI == null || process.env.CI === ''),
    onCancel = () => process.exit(0),
  }: PromptOptions = {}
): Promise<AnswerList<T>> {
  const parsed = parseArgs(command, args);

  for (const [key, question] of Object.entries(questions)) {
    const q = 'prompt' in question ? await question.prompt() : question;

    if (q === null) {
      continue;
    }

    if (key in parsed) {
      let value: unknown =
        parsed[key] ??
        (question.alias != null ? parsed[question.alias] : undefined);

      let error;

      switch (q.type) {
        case 'text':
          if (typeof value !== 'string') {
            error = new Error(`Invalid value for ${key}. Expected string.`);
          }

          break;
        case 'select':
          if (q.choices.every((c) => c.value !== value)) {
            error = new Error(
              `Invalid value for ${key}. Expected one of ${q.choices.map((c) => c.value).join(', ')}.`
            );
          }

          break;
        case 'multiselect':
          {
            const result =
              typeof value === 'string'
                ? value.split(',')
                : value === false
                  ? []
                  : null;

            if (
              result == null ||
              result.some((v) => q.choices.every((c) => c.value !== v))
            ) {
              error = new Error(
                `Invalid value for ${key}. Expected any of ${q.choices.map((c) => c.value).join(', ')}.`
              );
            }

            value = result;
          }

          break;
        case 'confirm':
          value = value === 'true' ? true : value === 'false' ? false : value;

          if (typeof value !== 'boolean') {
            error = new Error(`Invalid value for ${key}. Expected boolean.`);
          }

          break;
        case 'spinner':
        // Spinner is only used for prompts
      }

      if (!error && 'validate' in q && q.validate) {
        // @ts-expect-error: typescript can't properly infer the type of value
        const valid = q.validate(value);

        if (typeof valid === 'string') {
          error = new Error(`Invalid value for ${key}. ${valid}`);
        } else if (!valid) {
          error = new Error(`Invalid value for ${key}.`);
        }
      }

      // If we have a valid arg, add it to the context
      if (!error) {
        context[key] = value;
        continue;
      } else if (!interactive) {
        // If we have invalid args, throw an error when not in interactive mode
        // It will be handled by the prompts when in interactive mode
        throw error;
      }
    }

    const options = {
      stdin,
      stdout,
      onCancel,
    };

    // Enable raw mode to capture keypresses
    stdin.setRawMode(true);
    stdin.resume();

    try {
      switch (q.type) {
        case 'text':
          context[key] = await text(q, options);
          break;
        case 'select':
        case 'multiselect':
        case 'confirm':
          context[key] = await select(q, options);
          break;
        case 'spinner':
          context[key] = await spinner(q, options);
          break;
      }
    } finally {
      stdin.setRawMode(false);
      stdin.pause();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  return context as AnswerList<T>;
}
