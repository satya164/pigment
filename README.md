# pigment

A library for creating interactive command-line applications.

![Demo](./demo.svg)

> [!WARNING]
> This library is a work-in-progress and is not yet ready for production use.

## Features

- Works in both interactive and non-interactive modes with a single configuration
- Fully typed with TypeScript, with automatic type inference for prompt results
- Support for text, select, multiselect, confirm, and async tasks

## Installation

```sh
npm install pigment
```

## Quick Start

```ts
import { create } from 'pigment';

const prompt = create(['<name>'], {
  age: {
    type: 'text',
    description: 'Your age',
    message: 'How old are you?',
    required: true,
  },
  drink: {
    type: 'select',
    description: 'Favorite drink',
    message: 'What is your favorite drink?',
    choices: [
      { title: 'Coffee', value: 'coffee' },
      { title: 'Tea', value: 'tea' },
    ],
  },
});

const answers = await prompt.show({
  name: 'my-cli',
  version: '1.0.0',
  description: 'A CLI tool',
});

console.log(answers); // { name: string; age: string; drink: 'coffee' | 'tea' | undefined }
```

## Positional Arguments

The first parameter to `create()` allows you to define positional arguments:

```ts
const prompt = create(['<source>', '<destination>'], {
  /* ... */
});
```

The positional arguments support 2 types:

- Required: `<argument>`
- Optional: `[argument]`

CLI usage:

```sh
my-cli source.txt dest.txt
```

## Questions

The second parameter to `create()` is an object defining the questions:

```ts
const prompt = create(['<name>'], {
  username: {
    type: 'text',
    description: 'Your username',
    message: 'What is your username?',
    required: true,
  },
  drink: {
    type: 'select',
    description: 'Favorite drink',
    message: 'What is your favorite drink?',
    choices: [
      { title: 'Coffee', value: 'coffee' },
      { title: 'Tea', value: 'tea' },
    ],
    default: 'tea',
  },
});
```

When in interactive mode, users will be prompted for each question. In non-interactive mode, users can provide answers via CLI flags:

```sh
my-cli John --username john --drink coffee
```

It's also possible to mix interactive and non-interactive modes by providing some answers via CLI flags and prompting for the rest.

The key of each question in the configuration object is used as the name. The answer will be available in the results object under a property with the same name. It's also used for the CLI flags, prefixed with `--` (e.g., `--username` for the `username` question).

Each question object can have the following properties:

- `type`: The type of the question (e.g., `text`, `select`, `multiselect`, `confirm`).
- `alias`: A short flag alias for the question (e.g., `-u` for `--username`).
- `description`: A brief description of the question. This is used in the help text for the CLI arguments.
- `message`: The prompt message displayed to the user in interactive mode.
- `required`: Whether the question is mandatory. If `true`, the prompt will not accept empty input in interactive mode, and in non-interactive mode, the user must provide a value via CLI arguments. Defaults to `false`.
- `default`: A default value for the question. It can be a static value or a function that returns a value or a promise containing a value:

  ```ts
  default: () => {
    const answers = prompt.read();

    return answers.username?.toLowerCase();
  };
  ```

  It is used if no CLI argument is provided for the question, and as the initial value in interactive mode.

- `validate`: Function to validate user input. It should return `true` if the input is valid, `false` or a string with an error message if invalid:

  ```ts
  validate: (value) => {
    if (value.length < 3) {
      return 'Value must be at least 3 characters';
    }

    return true;
  };
  ```

- `skip`: A boolean or function that returns a boolean or a promise containing boolean to conditionally skip the question. It should return `true` to skip, `false` otherwise:

  ```ts
  skip: async () => {
    const answers = prompt.read();

    return answers.drink !== 'coffee';
  };
  ```

  If a question is skipped, the `required` option is ignored. If a `default` value is provided, it will be used as the answer.

### Reading Current Answers

The current answers can be read at any time using `prompt.read()`. This is useful for implementing dynamic logic.

```ts
const answers = prompt.read();
```

### Question Types

#### Text

Text questions to allow users to enter text in an input field:

```ts
{
  username: {
    type: 'text',
    description: 'Username',
    message: 'Enter your username',
  }
}
```

Usage in CLI arguments:

```sh
my-cli --username john
```

#### Select

Single-choice selection from a list of options.

```ts
{
  drink: {
    type: 'select',
    description: 'Favorite drink',
    message: 'Choose your drink',
    choices: [
      { title: 'Coffee', value: 'coffee' },
      { title: 'Tea', value: 'tea' },
    ],
  }
}
```

The `choices` array contains objects with the following properties:

- `title`: The display text for the option.
- `description`: (Optional) Additional description for the option.
- `value`: The value associated with the option that's used for the answer.
- `skip`: A boolean or function that returns a boolean or a promise containing boolean to conditionally hide the choice:

Usage in CLI arguments:

```sh
my-cli --drink coffee
```

#### Multiselect

Multiple-choice selection from a list of options.

```ts
{
  fruits: {
    type: 'multiselect',
    description: 'Favorite fruits',
    message: 'Select your favorite fruits',
    choices: [
      { title: 'Apple', value: 'apple' },
      { title: 'Banana', value: 'banana' },
      { title: 'Orange', value: 'orange' },
    ],
  }
}
```

The `choices` array contains objects with the following properties:

- `title`: The display text for the option.
- `description`: An optional description for the option.
- `value`: The value associated with the option that's used for the answer.
- `skip`: A boolean or function that returns a boolean or a promise containing boolean to conditionally hide the choice:

Usage in CLI arguments:

```sh
my-cli --fruits apple --fruits banana
```

An empty array can be provided as:

```sh
my-cli --fruits=
```

#### Confirm

Confirmation questions for yes/no answers.

```ts
{
  adult: {
    type: 'confirm',
    description: 'Age confirmation',
    message: 'Are you over 18?',
  }
}
```

Usage in CLI arguments:

```sh
my-cli --adult
```

The argument can be prefixed with `no-` to indicate a negative response:

```sh
my-cli --no-adult
```

#### Task

Asynchronous task that performs an action. This is shown in both interactive and non-interactive modes.

It takes an async generator function which can yield a message to update the spinner text during execution.

```ts
{
  data: {
    type: 'task',
    description: 'Load data',
    message: 'Loading data...',
    task: async function* () {
      yield { message: 'Fetching from API...' };

      const response = await fetch('https://api.example.com/data');
      const data = await response.json();

      yield { message: 'Processing...' };

      // Process data...

      return {
        message: 'Data loaded successfully',
        value: data,
      };
    },
  }
}
```

### Showing the Prompt

After creating the prompt with `create()`, you can show it using the `show()` method.

```ts
prompt.show({
  name: 'my-cli',
  description: 'A CLI tool',
  version: '1.0.0',
});
```

It takes an options object with the following properties:

- `name`: The name of the CLI application. Used in the help text with the `--help` flag.
- `description`: A brief description of the CLI application. Shown in the help text with the `--help` flag.
- `version`: The version of the CLI application. Shown with the `--version` flag.
- `args`: An array of strings representing the command-line arguments. Defaults to `process.argv.slice(2)`.
- `env`: An object representing the environment variables to read variables such as `CI`, `TERM`, etc. Defaults to `process.env`.
- `stdin`: The readable stream to use for input. Defaults to `process.stdin`.
- `stdout`: The writable stream to use for output. Defaults to `process.stdout`.
- `onExit`: A callback function that is called when the prompt exits. Defaults to `process.exit`.
- `onCancel`: A callback function that is called when the prompt is cancelled (e.g., via <kbd>Ctrl+C</kbd>).

## License

MIT
