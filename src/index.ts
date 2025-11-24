import { parseArgs, styleText } from 'node:util';
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
  // Ensure required positionals don't come after optional ones
  let foundOptional = false;

  for (const positional of positionals) {
    const isOptional = positional.startsWith('[');

    if (foundOptional && !isOptional) {
      throw new Error(
        `Invalid positional arguments: required argument '${positional}' cannot appear after optional arguments (got '${positionals.join(' ')}').`
      );
    }

    if (isOptional) {
      foundOptional = true;
    }
  }

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
    env = process.env,
    stdin = process.stdin,
    stdout = process.stdout,
    onCancel = () => process.exit(0),
  }: PromptOptions
): Promise<AnswerList<P, Q> | undefined> {
  if (args.length === 1) {
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (args[0]) {
      case '-v':
      case '--version': {
        if (version != null) {
          stdout.write(`${version}\n`);

          return;
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

        return;
      }
    }
  }

  const options = Object.fromEntries(
    Object.entries(questions)
      .map(([key, question]) => {
        if (question.type === 'task') {
          return null;
        }

        let type: 'string' | 'boolean' = 'string';
        let multiple = false;

        switch (question.type) {
          case 'text':
          case 'select':
          case 'multiselect':
            type = 'string';
            multiple = question.type === 'multiselect';
            break;
          case 'confirm':
            type = 'boolean';
            break;
        }

        return [
          key,
          'alias' in question && question.alias != null
            ? {
                type,
                multiple,
                short: question.alias,
              }
            : {
                type,
                multiple,
              },
        ] as const;
      })
      .filter((entry) => entry != null)
  );

  const {
    values: {
      interactive = stdout.isTTY &&
        env.TERM !== 'dumb' &&
        (env.CI == null || env.CI === ''),
      ...parsed
    },
    positionals: positionalArgs,
  } = parseArgs({
    args,
    strict: true,
    allowPositionals: true,
    allowNegative: true,
    options: {
      interactive: { type: 'boolean' },
      ...options,
    },
  });

  for (const positional of positionals) {
    const key = positional.slice(1, -1);
    const value = positionalArgs.shift();

    if (value != null) {
      context[key] = value;
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
        // @ts-expect-error: parsed doesn't have correct types
        parsed[key];

      let error;

      switch (q.type) {
        case 'text':
          if (typeof value !== 'string') {
            error = new Error(`Invalid value for '${key}'. Expected string.`);
          } else if ('required' in q && q.required === true && value === '') {
            error = new Error(
              `Invalid value for '${key}'. It cannot be empty.`
            );
          }

          break;
        case 'select':
          if (q.choices.every((c) => c.value !== value)) {
            error = new Error(
              `Invalid value for '${key}'. Expected one of: ${q.choices.map((c) => `'${c.value}'`).join(', ')}.`
            );
          }

          break;
        case 'multiselect':
          {
            // Strip empty strings from array
            // Allows --value= for empty array
            const result = Array.isArray(value)
              ? value.filter((v) => v !== '')
              : null;

            if (
              result == null ||
              result.some((v) => q.choices.every((c) => c.value !== v))
            ) {
              error = new Error(
                `Invalid value for '${key}'. Expected any of: ${q.choices.map((c) => `'${c.value}'`).join(', ')}.`
              );
            }

            value = result;
          }

          break;
        case 'confirm':
          if (typeof value !== 'boolean') {
            error = new Error(`Invalid value for '${key}'. Expected boolean.`);
          }

          break;
        case 'task':
          // Task is not used for CLI arguments
          break;
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
      env,
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
          typeof q.default === 'function' ? await q.default() : q.default;

        context[key] = defaultValue;
      }

      continue;
    }

    // Always run spinner tasks
    // even in non-interactive mode
    if (q.type === 'task') {
      context[key] = await spinner(q, options);
      continue;
    }

    if (!interactive) {
      // Check if required field is missing in non-interactive mode
      if ('required' in q && q.required === true && !(key in context)) {
        throw new Error(
          `Missing required value for '${key}'. Please provide a value using --${key}.`
        );
      }

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
        default:
          // exhaustive check
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw q satisfies never;
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
