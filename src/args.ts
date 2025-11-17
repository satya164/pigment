import type { PositionalArgument } from './types.ts';

export function parseArgs(
  positionals: PositionalArgument[],
  questions: Record<string, unknown>,
  args: string[]
) {
  const parsedPositionals = positionals.map((arg) => {
    if (arg.startsWith('[') && arg.endsWith(']')) {
      return {
        name: arg.slice(1, -1),
        optional: true,
      };
    } else if (arg.startsWith('<') && arg.endsWith('>')) {
      return {
        name: arg.slice(1, -1),
        optional: false,
      };
    }

    throw new Error(`Argument must be wrapped in [] or <> (got '${arg}')`);
  });

  let foundOptional = false;

  for (const { name, optional } of parsedPositionals) {
    if (optional) {
      foundOptional = true;
    } else if (foundOptional) {
      throw new Error(
        `Required argument '${name}' must come before optional arguments`
      );
    }
  }

  const parsed: Record<string, string | boolean> = {};

  let positional = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg == null) {
      throw new Error(`Invalid argument at index '${String(i)}'`);
    }

    if (arg.startsWith('-')) {
      positional = false;

      if (arg.includes('=')) {
        const [key, value] = arg.split('=');

        if (key == null || value == null) {
          throw new Error(`Invalid argument '${arg}'`);
        }

        const name = getArgName(key);

        if (name in parsed) {
          throw new Error(`Duplicate argument '${key}'`);
        }

        parsed[name] = value;
      } else {
        let negate = false;

        if (arg.startsWith('--no-')) {
          negate = true;
        }

        const name = getArgName(arg);

        if (name in parsed) {
          throw new Error(`Duplicate argument '${arg}'`);
        }

        parsed[name] = negate ? false : true;
      }
    } else if (positional) {
      const item = parsedPositionals[i];

      if (item == null) {
        throw new Error(`Invalid positional argument '${arg}'`);
      }

      parsed[item.name] = arg;
    } else {
      const prev = args[i - 1];

      if (
        prev != null &&
        prev.startsWith('-') &&
        !prev.includes('=') &&
        !prev.startsWith('--no-')
      ) {
        const name = getArgName(prev);

        parsed[name] = arg;
      } else {
        throw new Error(`Invalid argument '${arg}'`);
      }
    }
  }

  for (const { name, optional } of parsedPositionals) {
    if (!optional && !(name in parsed)) {
      throw new Error(`Missing required positional argument '${name}'`);
    }
  }

  return Object.fromEntries(
    Object.entries(parsed).map(([k, value]) => {
      let key = k;

      if (parsedPositionals.some((p) => p.name === key)) {
        return [key, value];
      }

      if (key in questions) {
        return [key, value];
      }

      key = kebabToCamelCase(key);

      if (key in questions) {
        return [key, value];
      }

      return [k, value];
    })
  );
}

function getArgName(arg: string) {
  const prefixes = ['--no-', '--', '-'];

  for (const prefix of prefixes) {
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length);
    }
  }

  return arg;
}

function kebabToCamelCase(text: string) {
  return text.replace(/-./g, (x) => x[1]!.toUpperCase());
}
