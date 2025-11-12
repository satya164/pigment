export function parseArgs(command: string, args: string[]) {
  if (!command.startsWith('$0 ')) {
    throw new Error('Command must start with $0');
  }

  const positionals = command
    .split(' ')
    .filter(Boolean)
    .slice(1)
    .map((arg) => {
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

      throw new Error(`Argument must be wrapped in [] or <> (got ${arg})`);
    });

  let foundOptional = false;

  for (const { name, optional } of positionals) {
    if (optional) {
      foundOptional = true;
    } else if (foundOptional) {
      throw new Error(
        `Required argument ${name} must come before optional arguments`
      );
    }
  }

  const parsed: Record<string, string | boolean> = {};

  let positional = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg == null) {
      throw new Error(`Invalid argument at index ${String(i)}`);
    }

    if (arg.startsWith('-')) {
      positional = false;

      if (arg.includes('=')) {
        const [key, value] = arg.split('=');

        if (key == null || value == null) {
          throw new Error(`Invalid argument ${arg}`);
        }

        const name = getArgName(key);

        if (name in parsed) {
          throw new Error(`Duplicate argument ${key}`);
        }

        parsed[name] = value;
      } else {
        let negate = false;

        if (arg.startsWith('--no-')) {
          negate = true;
        }

        const name = getArgName(arg);

        if (name in parsed) {
          throw new Error(`Duplicate argument ${arg}`);
        }

        parsed[name] = negate ? false : true;
      }
    } else if (positional) {
      const item = positionals[i];

      if (item == null) {
        throw new Error(`Invalid positional argument ${arg}`);
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
        throw new Error(`Invalid argument ${arg}`);
      }
    }
  }

  return parsed;
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
