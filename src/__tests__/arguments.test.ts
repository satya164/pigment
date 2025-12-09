import assert from 'node:assert';
import { PassThrough } from 'node:stream';
import { describe, test } from 'node:test';
import { create } from '../index.ts';

function createMockStreams() {
  return {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    stdin: new PassThrough() as unknown as NodeJS.ReadStream,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    stdout: new PassThrough() as unknown as NodeJS.WriteStream,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    stderr: new PassThrough() as unknown as NodeJS.WriteStream,
  };
}

void describe('positional arguments', () => {
  void test('throws error when required argument comes after optional', () => {
    assert.throws(
      () => {
        create(['[optional]', '<required>'], {});
      },
      (error: Error) => {
        assert.strictEqual(
          error.message,
          "Required argument '<required>' cannot appear after optional arguments"
        );
        return true;
      }
    );
  });

  void test('parses required positional argument', async () => {
    const prompt = create(['<name>'], {});
    const { stdin, stdout } = createMockStreams();

    const result = await prompt.show({
      name: 'test',
      args: ['Alice'],
      stdin,
      stdout,
    });

    assert.strictEqual(result?.name, 'Alice');
  });

  void test('parses optional positional argument when provided', async () => {
    const prompt = create(['[directory]'], {});
    const { stdin, stdout } = createMockStreams();

    const result = await prompt.show({
      name: 'test',
      args: ['src'],
      stdin,
      stdout,
    });

    assert.strictEqual(result?.directory, 'src');
  });

  void test('handles missing optional positional argument', async () => {
    const prompt = create(['[directory]'], {});
    const { stdin, stdout } = createMockStreams();

    const result = await prompt.show({
      name: 'test',
      args: [],
      stdin,
      stdout,
    });

    assert.strictEqual(result?.directory, undefined);
  });

  void test('parses multiple positional arguments', async () => {
    const prompt = create(['<name>', '<email>', '[role]', '[age]'], {});
    const { stdin, stdout } = createMockStreams();

    const result = await prompt.show({
      name: 'test',
      args: ['Alice', 'alice@example.com', 'admin'],
      stdin,
      stdout,
    });

    assert.strictEqual(result?.name, 'Alice');
    assert.strictEqual(result.email, 'alice@example.com');
    assert.strictEqual(result.role, 'admin');
    assert.strictEqual(result.age, undefined);
  });
});

void describe('text questions', () => {
  void test('parses text argument with long flag', async () => {
    const prompt = create([], {
      username: {
        type: 'text',
        description: 'Username',
        message: 'Enter username',
      },
    });

    const { stdin, stdout } = createMockStreams();

    const result = await prompt.show({
      name: 'test',
      args: ['--username', 'Alice'],
      stdin,
      stdout,
    });

    assert.strictEqual(result?.username, 'Alice');
  });

  void test('parses text argument with short flag', async () => {
    const prompt = create([], {
      username: {
        type: 'text',
        alias: 'u',
        description: 'Username',
        message: 'Enter username',
      },
    });

    const { stdin, stdout } = createMockStreams();

    const result = await prompt.show({
      name: 'test',
      args: ['-u', 'Bob'],
      stdin,
      stdout,
    });

    assert.strictEqual(result?.username, 'Bob');
  });

  void test('validates text argument', async () => {
    const prompt = create([], {
      username: {
        type: 'text',
        description: 'Username',
        message: 'Enter username',
        validate: (value) => value.length >= 3,
      },
    });

    const { stdin, stdout, stderr } = createMockStreams();

    let exitCode: number | undefined;

    await prompt.show({
      name: 'test',
      args: ['--username', 'ab'],
      stdin,
      stdout,
      stderr,
      onExit: (code) => {
        exitCode = code;
      },
    });

    assert.strictEqual(exitCode, 1);

    const output = String(stderr.read());

    assert.ok(output);
    assert.match(output, /Error: Invalid value for option '--username'/);
  });

  void test('validates text argument with custom message', async () => {
    const prompt = create([], {
      username: {
        type: 'text',
        description: 'Username',
        message: 'Enter username',
        validate: (value) =>
          value.length >= 3 ? true : 'Username must be at least 3 characters',
      },
    });

    const { stdin, stdout, stderr } = createMockStreams();

    let exitCode: number | undefined;

    await prompt.show({
      name: 'test',
      args: ['--username', 'ab'],
      stdin,
      stdout,
      stderr,
      onExit: (code) => {
        exitCode = code;
      },
    });

    assert.strictEqual(exitCode, 1);

    const output = String(stderr.read());

    assert.ok(output);
    assert.match(
      output,
      /Error: Invalid value for option '--username'. Username must be at least 3 characters/
    );
  });

  void test('rejects missing value for text argument', async () => {
    const prompt = create([], {
      username: {
        type: 'text',
        description: 'Username',
        message: 'Enter username',
      },
    });

    const { stdin, stdout, stderr } = createMockStreams();

    let exitCode: number | undefined;

    await prompt.show({
      name: 'test',
      args: ['--username'],
      stdin,
      stdout,
      stderr,
      onExit: (code) => {
        exitCode = code;
      },
    });

    assert.strictEqual(exitCode, 1);

    const output = String(stderr.read());

    assert.ok(output);
    assert.match(output, /Error: Option '--username <value>' argument missing/);
  });
});

void describe('select questions', () => {
  void test('parses select argument', async () => {
    const prompt = create([], {
      drink: {
        type: 'select',
        description: 'Favorite drink',
        message: 'Choose a drink',
        choices: [
          { title: 'Coffee', value: 'coffee' },
          { title: 'Tea', value: 'tea' },
        ],
      },
    });

    const { stdin, stdout } = createMockStreams();

    const result = await prompt.show({
      name: 'test',
      args: ['--drink', 'coffee'],
      stdin,
      stdout,
    });

    assert.strictEqual(result?.drink, 'coffee');
  });

  void test('rejects invalid select value', async () => {
    const prompt = create([], {
      drink: {
        type: 'select',
        description: 'Favorite drink',
        message: 'Choose a drink',
        choices: [
          { title: 'Coffee', value: 'coffee' },
          { title: 'Tea', value: 'tea' },
        ],
      },
    });

    const { stdin, stdout, stderr } = createMockStreams();

    let exitCode: number | undefined;

    await prompt.show({
      name: 'test',
      args: ['--drink', 'soda'],
      stdin,
      stdout,
      stderr,
      onExit: (code) => {
        exitCode = code;
      },
    });

    assert.strictEqual(exitCode, 1);

    const output = String(stderr.read());

    assert.ok(output);
    assert.match(
      output,
      /Error: Invalid value for option '--drink'. Expected one of 'coffee', 'tea', got 'soda'/
    );
  });

  void test('does not include skipped choices when parsing select arguments', async () => {
    const prompt = create([], {
      drink: {
        type: 'select',
        description: 'Favorite drink',
        message: 'Choose a drink',
        choices: [
          { title: 'Coffee', value: 'coffee' },
          { title: 'Tea', value: 'tea', skip: true },
        ],
      },
    });
    const { stdin, stdout, stderr } = createMockStreams();

    const result = await prompt.show({
      name: 'test',
      args: ['--drink', 'coffee'],
      stdin,
      stdout,
    });

    assert.strictEqual(result?.drink, 'coffee');

    let exitCode: number | undefined;

    await prompt.show({
      name: 'test',
      args: ['--drink', 'tea'],
      stdin,
      stdout,
      stderr,
      onExit: (code) => {
        exitCode = code;
      },
    });

    assert.strictEqual(exitCode, 1);

    const output = String(stderr.read());

    assert.ok(output);
    assert.match(
      output,
      /Error: Invalid value for option '--drink'. Expected one of 'coffee', got 'tea'/
    );
  });

  void test('validates select argument', async () => {
    const prompt = create([], {
      drink: {
        type: 'select',
        description: 'Favorite drink',
        message: 'Choose a drink',
        choices: [
          { title: 'Coffee', value: 'coffee' },
          { title: 'Tea', value: 'tea' },
        ],
        validate: (value) => value === 'coffee',
      },
    });

    const { stdin, stdout, stderr } = createMockStreams();

    let exitCode: number | undefined;

    await prompt.show({
      name: 'test',
      args: ['--drink', 'tea'],
      stdin,
      stdout,
      stderr,
      onExit: (code) => {
        exitCode = code;
      },
    });

    assert.strictEqual(exitCode, 1);

    const output = String(stderr.read());

    assert.ok(output);
    assert.match(output, /Error: Invalid value for option '--drink'/);
  });
});

void describe('multiselect questions', () => {
  void test('parses multiselect argument with single value', async () => {
    const prompt = create([], {
      fruits: {
        type: 'multiselect',
        description: 'Favorite fruits',
        message: 'Choose fruits',
        choices: [
          { title: 'Apple', value: 'apple' },
          { title: 'Banana', value: 'banana' },
        ],
      },
    });
    const { stdin, stdout } = createMockStreams();

    const result = await prompt.show({
      name: 'test',
      args: ['--fruits', 'apple'],
      stdin,
      stdout,
    });

    assert.deepStrictEqual(result?.fruits, ['apple']);
  });

  void test('parses multiselect argument with multiple values', async () => {
    const prompt = create([], {
      fruits: {
        type: 'multiselect',
        description: 'Favorite fruits',
        message: 'Choose fruits',
        choices: [
          { title: 'Apple', value: 'apple' },
          { title: 'Banana', value: 'banana' },
          { title: 'Orange', value: 'orange' },
        ],
      },
    });

    const { stdin, stdout } = createMockStreams();

    const result = await prompt.show({
      name: 'test',
      args: ['--fruits', 'apple', '--fruits', 'banana'],
      stdin,
      stdout,
    });

    assert.deepStrictEqual(result?.fruits, ['apple', 'banana']);
  });

  void test('parses empty multiselect argument', async () => {
    const prompt = create([], {
      fruits: {
        type: 'multiselect',
        description: 'Favorite fruits',
        message: 'Choose fruits',
        choices: [
          { title: 'Apple', value: 'apple' },
          { title: 'Banana', value: 'banana' },
        ],
      },
    });

    const { stdin, stdout } = createMockStreams();

    const result = await prompt.show({
      name: 'test',
      args: ['--fruits='],
      stdin,
      stdout,
    });

    assert.deepStrictEqual(result?.fruits, []);
  });

  void test('rejects invalid multiselect value', async () => {
    const prompt = create([], {
      fruits: {
        type: 'multiselect',
        description: 'Favorite fruits',
        message: 'Choose fruits',
        choices: [
          { title: 'Apple', value: 'apple' },
          { title: 'Banana', value: 'banana' },
        ],
      },
    });

    const { stdin, stdout, stderr } = createMockStreams();

    let exitCode: number | undefined;

    await prompt.show({
      name: 'test',
      args: ['--fruits', 'apple', '--fruits', 'grape'],
      stdin,
      stdout,
      stderr,
      onExit: (code) => {
        exitCode = code;
      },
    });

    assert.strictEqual(exitCode, 1);

    const output = String(stderr.read());

    assert.ok(output);
    assert.match(
      output,
      /Error: Invalid value for option '--fruits'. Expected one of 'apple', 'banana', got 'apple, grape'/
    );
  });

  void test('does not include skipped choices when parsing multiselect arguments', async () => {
    const prompt = create([], {
      fruits: {
        type: 'multiselect',
        description: 'Favorite fruits',
        message: 'Choose fruits',
        choices: [
          { title: 'Apple', value: 'apple' },
          { title: 'Banana', value: 'banana' },
          { title: 'Cherry', value: 'cherry', skip: true },
        ],
      },
    });
    const { stdin, stdout, stderr } = createMockStreams();

    const result = await prompt.show({
      name: 'test',
      args: ['--fruits', 'apple', '--fruits', 'banana'],
      stdin,
      stdout,
    });

    assert.deepStrictEqual(result?.fruits, ['apple', 'banana']);

    let exitCode: number | undefined;

    await prompt.show({
      name: 'test',
      args: ['--fruits', 'banana', '--fruits', 'cherry'],
      stdin,
      stdout,
      stderr,
      onExit: (code) => {
        exitCode = code;
      },
    });

    assert.strictEqual(exitCode, 1);

    const output = String(stderr.read());

    assert.ok(output);
    assert.match(
      output,
      /Error: Invalid value for option '--fruits'. Expected one of 'apple', 'banana', got 'banana, cherry'/
    );
  });

  void test('validates multiselect argument', async () => {
    const prompt = create([], {
      fruits: {
        type: 'multiselect',
        description: 'Favorite fruits',
        message: 'Choose fruits',
        choices: [
          { title: 'Apple', value: 'apple' },
          { title: 'Banana', value: 'banana' },
        ],
        validate: (value) =>
          value.length > 0 ? true : 'Select at least one fruit',
      },
    });

    const { stdin, stdout, stderr } = createMockStreams();

    let exitCode: number | undefined;

    await prompt.show({
      name: 'test',
      args: ['--fruits='],
      stdin,
      stdout,
      stderr,
      onExit: (code) => {
        exitCode = code;
      },
    });

    assert.strictEqual(exitCode, 1);

    const output = String(stderr.read());

    assert.ok(output);
    assert.match(
      output,
      /Error: Invalid value for option '--fruits'. Select at least one fruit/
    );
  });
});

void describe('confirm questions', () => {
  void test('parses confirm argument as true', async () => {
    const prompt = create([], {
      adult: {
        type: 'confirm',
        description: 'Are you an adult',
        message: 'Over 18?',
      },
    });

    const { stdin, stdout } = createMockStreams();

    const result = await prompt.show({
      name: 'test',
      args: ['--adult'],
      stdin,
      stdout,
    });

    assert.strictEqual(result?.adult, true);
  });

  void test('parses confirm argument as false with --no prefix', async () => {
    const prompt = create([], {
      adult: {
        type: 'confirm',
        description: 'Are you an adult',
        message: 'Over 18?',
      },
    });
    const { stdin, stdout } = createMockStreams();

    const result = await prompt.show({
      name: 'test',
      args: ['--no-adult'],
      stdin,
      stdout,
    });

    assert.strictEqual(result?.adult, false);
  });

  void test('validates confirm argument', async () => {
    const prompt = create([], {
      agree: {
        type: 'confirm',
        description: 'Agree to terms',
        message: 'Do you agree?',
        validate: (value) => value,
      },
    });

    const { stdin, stdout, stderr } = createMockStreams();

    let exitCode: number | undefined;

    await prompt.show({
      name: 'test',
      args: ['--no-agree'],
      stdin,
      stdout,
      stderr,
      onExit: (code) => {
        exitCode = code;
      },
    });

    assert.strictEqual(exitCode, 1);

    const output = String(stderr.read());

    assert.ok(output);
    assert.match(output, /Error: Invalid value for option '--agree'/);
  });
});

void describe('mixed arguments', () => {
  void test('parses multiple types of arguments in any order', async () => {
    const prompt = create(['<name>', '[directory]'], {
      username: {
        type: 'text',
        alias: 'u',
        description: 'Username',
        message: 'Enter username',
      },
      drink: {
        type: 'select',
        description: 'Favorite drink',
        message: 'Choose a drink',
        choices: [
          { title: 'Coffee', value: 'coffee' },
          { title: 'Tea', value: 'tea' },
        ],
      },
      fruits: {
        type: 'multiselect',
        description: 'Favorite fruits',
        message: 'Choose fruits',
        choices: [
          { title: 'Apple', value: 'apple' },
          { title: 'Banana', value: 'banana' },
        ],
      },
      verbose: {
        type: 'confirm',
        description: 'Verbose output',
        message: 'Verbose?',
      },
    });

    const { stdin, stdout } = createMockStreams();

    const result = await prompt.show({
      name: 'test',
      args: [
        'Alice',
        'src',
        '--fruits',
        'apple',
        '--fruits',
        'banana',
        '-u',
        'alice123',
        '--drink',
        'coffee',
        '--verbose',
      ],
      stdin,
      stdout,
    });

    assert.strictEqual(result?.name, 'Alice');
    assert.strictEqual(result.directory, 'src');
    assert.strictEqual(result.username, 'alice123');
    assert.strictEqual(result.drink, 'coffee');
    assert.deepStrictEqual(result.fruits, ['apple', 'banana']);
    assert.strictEqual(result.verbose, true);
  });
});

void describe('miscellaneous', () => {
  void test('handles kebab-case arguments', async () => {
    const prompt = create([], {
      'user-name': {
        type: 'text',
        description: 'Username',
        message: 'Enter username',
      },
    });

    const { stdin, stdout } = createMockStreams();

    const result = await prompt.show({
      name: 'test',
      args: ['--user-name', 'Alice'],
      stdin,
      stdout,
    });

    assert.strictEqual(result?.['user-name'], 'Alice');
  });

  void test('handles camelCase arguments', async () => {
    const prompt = create([], {
      userName: {
        type: 'text',
        description: 'Username',
        message: 'Enter username',
      },
    });

    const { stdin, stdout } = createMockStreams();

    const result = await prompt.show({
      name: 'test',
      args: ['--user-name', 'Alice'],
      stdin,
      stdout,
    });

    assert.strictEqual(result?.userName, 'Alice');
  });

  void test('uses default value for skipped question when not provided via args', async () => {
    const prompt = create([], {
      username: {
        type: 'text',
        description: 'Username',
        message: 'Enter username',
        skip: true,
        default: 'default-user',
      },
    });
    const { stdin, stdout } = createMockStreams();

    const result = await prompt.show({
      name: 'test',
      args: [],
      stdin,
      stdout,
    });

    assert.strictEqual(result?.username, 'default-user');
  });

  void test('handles async skip function', async () => {
    const prompt = create([], {
      sugar: {
        type: 'confirm',
        description: 'Sugar in coffee',
        message: 'Sugar?',
        skip: async () => {
          await Promise.resolve();
          return true;
        },
        default: false,
      },
    });

    const { stdin, stdout } = createMockStreams();

    const result = await prompt.show({
      name: 'test',
      args: [],
      stdin,
      stdout,
    });

    assert.strictEqual(result?.sugar, false);
  });

  void test('runs spinner tasks in non-interactive mode', async () => {
    const prompt = create([], {
      data: {
        type: 'task',
        description: 'Loading data',
        message: 'Loading...',
        task: async function* () {
          yield { message: 'Processing...' };

          await new Promise((resolve) => {
            setTimeout(resolve, 100);
          });

          return { message: 'Done', value: 'result' };
        },
      },
    });

    const { stdin, stdout } = createMockStreams();

    const result = await prompt.show({
      name: 'test',
      args: [],
      stdin,
      stdout,
    });

    assert.strictEqual(result?.data, 'result');
  });

  void test('throws error for extraneous arguments  ', async () => {
    const prompt = create([], {
      username: {
        type: 'text',
        description: 'Username',
        message: 'Enter username',
      },
    });

    const { stdin, stdout, stderr } = createMockStreams();

    let exitCode: number | undefined;

    await prompt.show({
      name: 'test',
      args: ['--username', 'Alice', '--extra', 'value'],
      stdin,
      stdout,
      stderr,
      onExit: (code) => {
        exitCode = code;
      },
    });

    assert.strictEqual(exitCode, 1);

    const output = String(stderr.read());

    assert.ok(output);
    assert.match(output, /Error: Unknown option.*--extra/);
  });

  void test('throws error for missing required question in non-interactive mode', async () => {
    const prompt = create([], {
      username: {
        type: 'text',
        description: 'Username',
        message: 'Enter username',
        required: true,
      },
    });

    const { stdin, stdout, stderr } = createMockStreams();

    let exitCode: number | undefined;

    await prompt.show({
      name: 'test',
      args: [],
      stdin,
      stdout,
      stderr,
      onExit: (code) => {
        exitCode = code;
      },
    });

    assert.strictEqual(exitCode, 1);

    const output = String(stderr.read());

    assert.ok(output);
    assert.match(
      output,
      /Error: Missing required option '--username'. Provide a value using --username/
    );
  });

  void test('does not throw error for missing required question when value is provided', async () => {
    const prompt = create([], {
      username: {
        type: 'text',
        description: 'Username',
        message: 'Enter username',
        required: true,
      },
    });

    const { stdin, stdout } = createMockStreams();

    const result = await prompt.show({
      name: 'test',
      args: ['--username', 'Alice'],
      stdin,
      stdout,
    });

    assert.strictEqual(result?.username, 'Alice');
  });

  void test('throws error for required question even when default is provided', async () => {
    const prompt = create([], {
      username: {
        type: 'text',
        description: 'Username',
        message: 'Enter username',
        required: true,
        default: 'default-user',
      },
    });

    const { stdin, stdout, stderr } = createMockStreams();

    let exitCode: number | undefined;

    await prompt.show({
      name: 'test',
      args: [],
      stdin,
      stdout,
      stderr,
      onExit: (code) => {
        exitCode = code;
      },
    });

    assert.strictEqual(exitCode, 1);

    const output = String(stderr.read());

    assert.ok(output);
    assert.match(
      output,
      /Error: Missing required option '--username'. Provide a value using --username/
    );
  });

  void test('throws error for empty value in required text question', async () => {
    const prompt = create([], {
      username: {
        type: 'text',
        description: 'Username',
        message: 'Enter username',
        required: true,
      },
    });

    const { stdin, stdout, stderr } = createMockStreams();

    let exitCode: number | undefined;

    await prompt.show({
      name: 'test',
      args: ['--username='],
      stdin,
      stdout,
      stderr,
      onExit: (code) => {
        exitCode = code;
      },
    });

    assert.strictEqual(exitCode, 1);

    const output = String(stderr.read());

    assert.ok(output);
    assert.match(
      output,
      /Error: Invalid value for option '--username'. Got empty string/
    );
  });

  void test('throws error for missing value after flag', async () => {
    const prompt = create([], {
      name: {
        type: 'text',
        description: 'Name',
        message: 'Enter name',
      },
    });

    const { stdin, stdout, stderr } = createMockStreams();

    let exitCode: number | undefined;

    await prompt.show({
      name: 'test',
      args: ['--name'],
      stdin,
      stdout,
      stderr,
      onExit: (code) => {
        exitCode = code;
      },
    });

    assert.strictEqual(exitCode, 1);

    const output = String(stderr.read());

    assert.ok(output);
    assert.match(output, /Error: Option '--name <value>' argument missing/);
  });

  void test('throws error for invalid select choice value', async () => {
    const prompt = create([], {
      color: {
        type: 'select',
        description: 'Favorite color',
        message: 'Choose color',
        choices: [
          { title: 'Red', value: 'red' },
          { title: 'Blue', value: 'blue' },
        ],
      },
    });

    const { stdin, stdout, stderr } = createMockStreams();

    let exitCode: number | undefined;

    await prompt.show({
      name: 'test',
      args: ['--color', 'green'],
      stdin,
      stdout,
      stderr,
      onExit: (code) => {
        exitCode = code;
      },
    });

    assert.strictEqual(exitCode, 1);

    const output = String(stderr.read());

    assert.ok(output);
    assert.match(
      output,
      /Error: Invalid value for option '--color'. Expected one of 'red', 'blue', got 'green'/
    );
  });

  void test('throws error for invalid multiselect choice value', async () => {
    const prompt = create([], {
      tags: {
        type: 'multiselect',
        description: 'Tags',
        message: 'Select tags',
        choices: [
          { title: 'JavaScript', value: 'js' },
          { title: 'TypeScript', value: 'ts' },
        ],
      },
    });

    const { stdin, stdout, stderr } = createMockStreams();

    let exitCode: number | undefined;

    await prompt.show({
      name: 'test',
      args: ['--tags', 'js', '--tags', 'python'],
      stdin,
      stdout,
      stderr,
      onExit: (code) => {
        exitCode = code;
      },
    });

    assert.strictEqual(exitCode, 1);

    const output = String(stderr.read());

    assert.ok(output);
    assert.match(
      output,
      /Error: Invalid value for option '--tags'. Expected one of 'js', 'ts', got 'js, python'/
    );
  });

  void test('throws error for non-array value in multiselect', async () => {
    const prompt = create([], {
      tags: {
        type: 'multiselect',
        description: 'Tags',
        message: 'Select tags',
        choices: [
          { title: 'JavaScript', value: 'js' },
          { title: 'TypeScript', value: 'ts' },
        ],
      },
    });

    const { stdin, stdout, stderr } = createMockStreams();

    let exitCode: number | undefined;

    await prompt.show({
      name: 'test',
      args: ['--tags'],
      stdin,
      stdout,
      stderr,
      onExit: (code) => {
        exitCode = code;
      },
    });

    assert.strictEqual(exitCode, 1);

    const output = String(stderr.read());

    assert.ok(output);
    assert.match(output, /Error: Option '--tags <value>' argument missing/);
  });

  void test('throws error for unknown short flag', async () => {
    const prompt = create([], {
      name: {
        type: 'text',
        description: 'Name',
        message: 'Enter name',
      },
    });

    const { stdin, stdout, stderr } = createMockStreams();

    let exitCode: number | undefined;

    await prompt.show({
      name: 'test',
      args: ['-x'],
      stdin,
      stdout,
      stderr,
      onExit: (code) => {
        exitCode = code;
      },
    });

    assert.strictEqual(exitCode, 1);

    const output = String(stderr.read());

    assert.ok(output);
    assert.match(output, /Error: Unknown option '-x'/);
  });
});
