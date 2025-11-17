import { styleText } from 'util';
import { parseArgs } from './args.ts';
import { select } from './select.ts';
import { spinner } from './spinner.ts';
import { text } from './text.ts';
import type {
  AnswerList,
  PositionalArgument,
  Prompt,
  PromptOptions,
  QuestionList,
} from './types.ts';
import { usage } from './usage.ts';

export function create<
  const P extends PositionalArgument[],
  const Q extends QuestionList<string>,
>(positionals: P, questions: Q): Prompt<P, Q> {
  const context: Partial<AnswerList<P, Q>> = {};

  return {
    show: async (options) => show(positionals, questions, context, options),
    read: () => context,
  };
}

async function show<
  const P extends PositionalArgument[],
  const Q extends QuestionList<string>,
>(
  positionals: P,
  questions: Q,
  context: Record<string, unknown>,
  {
    name,
    description,
    version,
    args = process.argv.slice(2),
    stdin = process.stdin,
    stdout = process.stdout,
    onExit = () => process.exit(0),
    onCancel = () => process.exit(0),
  }: PromptOptions
): Promise<AnswerList<P, Q>> {
  if (args.length === 1) {
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (args[0]) {
      case '-v':
      case '--version': {
        if (version != null) {
          stdout.write(`${version}\n`);

          onExit();
        }

        break;
      }

      case '-h':
      case '--help': {
        usage({
          name,
          description,
          positionals,
          questions,
          stdout,
        });

        onExit();
      }
    }
  }

  const {
    interactive = stdout.isTTY &&
      process.env.TERM !== 'dumb' &&
      (process.env.CI == null || process.env.CI === ''),
    ...parsed
  } = parseArgs(positionals, questions, args);

  if (typeof interactive !== 'boolean') {
    throw new Error(`Invalid value for 'interactive'. Expected boolean.`);
  }

  for (const positional of positionals) {
    const key = positional.slice(1, -1);

    if (key in parsed) {
      context[key] = parsed[key];
    }
  }

  for (const [key, question] of Object.entries(questions)) {
    let q = question;

    if ('choices' in q) {
      const choices = (
        await Promise.all(
          q.choices.map(async (choice) => {
            if ('skip' in choice) {
              const skip =
                typeof choice.skip === 'function'
                  ? await choice.skip()
                  : choice.skip;

              return skip === false ? choice : null;
            }

            return choice;
          })
        )
      ).filter((choice) => choice !== null);

      q = { ...q, choices };
    }

    if (key in parsed) {
      let value: unknown =
        parsed[key] ??
        (question.alias != null ? parsed[question.alias] : undefined);

      let error;

      switch (q.type) {
        case 'text':
          if (typeof value !== 'string') {
            error = new Error(`Invalid value for '${key}'. Expected string.`);
          }

          break;
        case 'select':
          if (q.choices.every((c) => c.value !== value)) {
            error = new Error(
              `Invalid value for '${key}'. Expected one of: ${q.choices.map((c) => `'${String(c.value)}'`).join(', ')}.`
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
                `Invalid value for '${key}'. Expected any of: ${q.choices.map((c) => `'${String(c.value)}'`).join(', ')}.`
              );
            }

            value = result;
          }

          break;
        case 'confirm':
          value = value === 'true' ? true : value === 'false' ? false : value;

          if (typeof value !== 'boolean') {
            error = new Error(`Invalid value for '${key}'. Expected boolean.`);
          }

          break;
        case 'spinner':
        // Spinner is only used for prompts
      }

      if (!error && 'validate' in q && q.validate) {
        // @ts-expect-error: typescript can't properly infer the type of value
        const validation = q.validate(value);

        if (typeof validation === 'string') {
          error = new Error(`Invalid value for '${key}'. ${validation}`);
        } else if (!validation) {
          error = new Error(`Invalid value for '${key}'.`);
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

    const skip =
      'skip' in q
        ? typeof q.skip === 'function'
          ? await q.skip()
          : (q.skip ?? false)
        : false;

    if (skip) {
      if ('default' in q) {
        const defaultValue: unknown =
          typeof q.default === 'function'
            ? // eslint-disable-next-line @typescript-eslint/no-unsafe-call
              await q.default()
            : q.default;

        context[key] = defaultValue;
      }

      continue;
    }

    if (!interactive) {
      continue;
    }

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
      stdout.write(styleText('reset', ''));
      stdin.setRawMode(false);
      stdin.pause();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  return context as AnswerList<P, Q>;
}
