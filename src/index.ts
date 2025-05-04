import { parseArgs } from './args.ts';
import { select, text } from './prompts.ts';
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
  const context: Record<string, unknown> = {};

  return {
    show: (options) => show(command, questions, context, options),
    read: () => context as Partial<AnswerList<T>>,
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
    interactive = Boolean(
      stdout.isTTY && process.env.TERM !== 'dumb' && !process.env.CI
    ),
    onCancel = () => process.exit(0),
  }: PromptOptions = {}
): Promise<AnswerList<T>> {
  const parsed = parseArgs(command, args);

  stdout.write('\n');

  for (const [key, question] of Object.entries(questions)) {
    const q =
      question != null && 'prompt' in question
        ? await question.prompt()
        : question;

    if (q === null) {
      continue;
    }

    if (key in parsed) {
      let value =
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
            const split = typeof value === 'string' ? value.split(',') : null;

            if (
              split?.length === 0 ||
              split?.some((v) => q.choices.every((c) => c.value !== v))
            ) {
              error = new Error(
                `Invalid value for ${key}. Expected any of ${q.choices.map((c) => c.value).join(', ')}.`
              );
            }
          }

          break;
        case 'confirm':
          {
            value = value === 'true' ? true : value === 'false' ? false : value;

            if (typeof value !== 'boolean') {
              error = new Error(`Invalid value for ${key}. Expected boolean.`);
            }
          }

          break;
      }

      if (!error && q.validate) {
        // @ts-expect-error
        const valid = q.validate(value);

        if (typeof valid === 'string') {
          error = new Error(`Invalid value for ${key}. ${valid}`);
        } else if (valid !== true) {
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

    switch (q.type) {
      case 'text':
        context[key] = await text(q.message, options);
        break;
      case 'select':
        context[key] = await select(q.message, q.choices, false, options);
        break;
      case 'multiselect':
        context[key] = await select(q.message, q.choices, true, options);
        break;
      case 'confirm':
        context[key] = await select(
          q.message,
          [
            { title: 'Yes', value: true },
            { title: 'No', value: false },
          ],
          false,
          options
        );
        break;
    }

    stdout.write('\n');
  }

  return context as AnswerList<T>;
}
