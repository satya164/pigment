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
  };
}

void describe('positional arguments', () => {
  void test('parses required positional argument', async () => {
    const p = create(['<name>'], {});
    const { stdin, stdout } = createMockStreams();

    const result = await p.show({
      name: 'test',
      args: ['Alice'],
      stdin,
      stdout,
    });

    assert.strictEqual(result.name, 'Alice');
  });

  void test('parses optional positional argument when provided', async () => {
    const p = create(['[directory]'], {});
    const { stdin, stdout } = createMockStreams();

    const result = await p.show({
      name: 'test',
      args: ['src'],
      stdin,
      stdout,
    });

    assert.strictEqual(result.directory, 'src');
  });

  void test('handles missing optional positional argument', async () => {
    const p = create(['[directory]'], {});
    const { stdin, stdout } = createMockStreams();

    const result = await p.show({
      name: 'test',
      args: [],
      stdin,
      stdout,
    });

    assert.strictEqual(result.directory, undefined);
  });

  void test('parses multiple positional arguments', async () => {
    const p = create(['<name>', '<email>', '[role]'], {});
    const { stdin, stdout } = createMockStreams();

    const result = await p.show({
      name: 'test',
      args: ['Alice', 'alice@example.com', 'admin'],
      stdin,
      stdout,
    });

    assert.strictEqual(result.name, 'Alice');
    assert.strictEqual(result.email, 'alice@example.com');
    assert.strictEqual(result.role, 'admin');
  });

  void test('parses positional arguments in correct order', async () => {
    const p = create(['<first>', '<second>'], {});
    const { stdin, stdout } = createMockStreams();

    const result = await p.show({
      name: 'test',
      args: ['value1', 'value2'],
      stdin,
      stdout,
    });

    assert.strictEqual(result.first, 'value1');
    assert.strictEqual(result.second, 'value2');
  });
});

void describe('text questions', () => {
  void test('parses text argument with long flag', async () => {
    const p = create([], {
      username: {
        type: 'text',
        description: 'Username',
        message: 'Enter username',
      },
    });
    const { stdin, stdout } = createMockStreams();

    const result = await p.show({
      name: 'test',
      args: ['--username', 'Alice'],
      stdin,
      stdout,
    });

    assert.strictEqual(result.username, 'Alice');
  });

  void test('parses text argument with short flag', async () => {
    const p = create([], {
      username: {
        type: 'text',
        alias: 'u',
        description: 'Username',
        message: 'Enter username',
      },
    });
    const { stdin, stdout } = createMockStreams();

    const result = await p.show({
      name: 'test',
      args: ['-u', 'Bob'],
      stdin,
      stdout,
    });

    assert.strictEqual(result.username, 'Bob');
  });

  void test('validates text argument', async () => {
    const p = create([], {
      username: {
        type: 'text',
        description: 'Username',
        message: 'Enter username',
        validate: (value) => value.length >= 3,
      },
    });
    const { stdin, stdout } = createMockStreams();

    await assert.rejects(
      async () => {
        await p.show({
          name: 'test',
          args: ['--username', 'ab'],
          stdin,
          stdout,
        });
      },
      (error: Error) => {
        assert.match(error.message, /Invalid value for 'username'/);
        return true;
      }
    );
  });

  void test('validates text argument with custom message', async () => {
    const p = create([], {
      username: {
        type: 'text',
        description: 'Username',
        message: 'Enter username',
        validate: (value) =>
          value.length >= 3 ? true : 'Username must be at least 3 characters',
      },
    });
    const { stdin, stdout } = createMockStreams();

    await assert.rejects(
      async () => {
        await p.show({
          name: 'test',
          args: ['--username', 'ab'],
          stdin,
          stdout,
        });
      },
      (error: Error) => {
        assert.match(error.message, /Username must be at least 3 characters/);
        return true;
      }
    );
  });

  void test('rejects non-string value for text argument', async () => {
    const p = create([], {
      username: {
        type: 'text',
        description: 'Username',
        message: 'Enter username',
      },
    });
    const { stdin, stdout } = createMockStreams();

    await assert.rejects(
      async () => {
        await p.show({
          name: 'test',
          args: ['--username'],
          stdin,
          stdout,
        });
      },
      (error: Error) => {
        assert.match(error.message, /argument missing/);
        return true;
      }
    );
  });
});

void describe('select questions', () => {
  void test('parses select argument', async () => {
    const p = create([], {
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

    const result = await p.show({
      name: 'test',
      args: ['--drink', 'coffee'],
      stdin,
      stdout,
    });

    assert.strictEqual(result.drink, 'coffee');
  });

  void test('rejects invalid select value', async () => {
    const p = create([], {
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

    await assert.rejects(
      async () => {
        await p.show({
          name: 'test',
          args: ['--drink', 'soda'],
          stdin,
          stdout,
        });
      },
      (error: Error) => {
        assert.match(error.message, /Invalid value for 'drink'/);
        assert.match(error.message, /'coffee', 'tea'/);
        return true;
      }
    );
  });

  void test('parses select argument with non-string value', async () => {
    const p = create([], {
      count: {
        type: 'select',
        description: 'Count',
        message: 'Choose count',
        choices: [
          { title: 'One', value: 1 },
          { title: 'Two', value: 2 },
        ],
      },
    });
    const { stdin, stdout } = createMockStreams();

    // Note: parseArgs returns strings, so '1' !== 1
    // This test verifies that validation properly rejects mismatched types
    await assert.rejects(
      async () => {
        await p.show({
          name: 'test',
          args: ['--count', '1'],
          stdin,
          stdout,
        });
      },
      (error: Error) => {
        assert.match(error.message, /Invalid value for 'count'/);
        return true;
      }
    );
  });

  void test('validates select argument', async () => {
    const p = create([], {
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
    const { stdin, stdout } = createMockStreams();

    await assert.rejects(
      async () => {
        await p.show({
          name: 'test',
          args: ['--drink', 'tea'],
          stdin,
          stdout,
        });
      },
      (error: Error) => {
        assert.match(error.message, /Invalid value for 'drink'/);
        return true;
      }
    );
  });
});

void describe('multiselect questions', () => {
  void test('parses multiselect argument with single value', async () => {
    const p = create([], {
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

    const result = await p.show({
      name: 'test',
      args: ['--fruits', 'apple'],
      stdin,
      stdout,
    });

    assert.deepStrictEqual(result.fruits, ['apple']);
  });

  void test('parses multiselect argument with multiple values', async () => {
    const p = create([], {
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

    const result = await p.show({
      name: 'test',
      args: ['--fruits', 'apple', '--fruits', 'banana'],
      stdin,
      stdout,
    });

    assert.deepStrictEqual(result.fruits, ['apple', 'banana']);
  });

  void test('parses empty multiselect argument', async () => {
    const p = create([], {
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

    const result = await p.show({
      name: 'test',
      args: ['--fruits='],
      stdin,
      stdout,
    });

    assert.deepStrictEqual(result.fruits, []);
  });

  void test('rejects invalid multiselect value', async () => {
    const p = create([], {
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

    await assert.rejects(
      async () => {
        await p.show({
          name: 'test',
          args: ['--fruits', 'apple', '--fruits', 'grape'],
          stdin,
          stdout,
        });
      },
      (error: Error) => {
        assert.match(error.message, /Invalid value for 'fruits'/);
        assert.match(error.message, /'apple', 'banana'/);
        return true;
      }
    );
  });

  void test('validates multiselect argument', async () => {
    const p = create([], {
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
    const { stdin, stdout } = createMockStreams();

    await assert.rejects(
      async () => {
        await p.show({
          name: 'test',
          args: ['--fruits='],
          stdin,
          stdout,
        });
      },
      (error: Error) => {
        assert.match(error.message, /Select at least one fruit/);
        return true;
      }
    );
  });
});

void describe('confirm questions', () => {
  void test('parses confirm argument as true', async () => {
    const p = create([], {
      adult: {
        type: 'confirm',
        description: 'Are you an adult',
        message: 'Over 18?',
      },
    });
    const { stdin, stdout } = createMockStreams();

    const result = await p.show({
      name: 'test',
      args: ['--adult'],
      stdin,
      stdout,
    });

    assert.strictEqual(result.adult, true);
  });

  void test('parses confirm argument as false with --no prefix', async () => {
    const p = create([], {
      adult: {
        type: 'confirm',
        description: 'Are you an adult',
        message: 'Over 18?',
      },
    });
    const { stdin, stdout } = createMockStreams();

    const result = await p.show({
      name: 'test',
      args: ['--no-adult'],
      stdin,
      stdout,
    });

    assert.strictEqual(result.adult, false);
  });

  void test('validates confirm argument', async () => {
    const p = create([], {
      agree: {
        type: 'confirm',
        description: 'Agree to terms',
        message: 'Do you agree?',
        validate: (value) => value,
      },
    });
    const { stdin, stdout } = createMockStreams();

    await assert.rejects(
      async () => {
        await p.show({
          name: 'test',
          args: ['--no-agree'],
          stdin,
          stdout,
        });
      },
      (error: Error) => {
        assert.match(error.message, /Invalid value for 'agree'/);
        return true;
      }
    );
  });
});

void describe('mixed arguments', () => {
  void test('parses positional and named arguments together', async () => {
    const p = create(['<project>'], {
      verbose: {
        type: 'confirm',
        description: 'Verbose output',
        message: 'Verbose?',
      },
    });
    const { stdin, stdout } = createMockStreams();

    const result = await p.show({
      name: 'test',
      args: ['my-project', '--verbose'],
      stdin,
      stdout,
    });

    assert.strictEqual(result.project, 'my-project');
    assert.strictEqual(result.verbose, true);
  });

  void test('parses multiple types of arguments', async () => {
    const p = create(['<name>', '[directory]'], {
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

    const result = await p.show({
      name: 'test',
      args: [
        'Alice',
        'src',
        '-u',
        'alice123',
        '--drink',
        'coffee',
        '--fruits',
        'apple',
        '--fruits',
        'banana',
        '--verbose',
      ],
      stdin,
      stdout,
    });

    assert.strictEqual(result.name, 'Alice');
    assert.strictEqual(result.directory, 'src');
    assert.strictEqual(result.username, 'alice123');
    assert.strictEqual(result.drink, 'coffee');
    assert.deepStrictEqual(result.fruits, ['apple', 'banana']);
    assert.strictEqual(result.verbose, true);
  });

  void test('handles arguments in any order', async () => {
    const p = create(['<name>'], {
      verbose: {
        type: 'confirm',
        description: 'Verbose output',
        message: 'Verbose?',
      },
      output: {
        type: 'text',
        description: 'Output file',
        message: 'Output file?',
      },
    });
    const { stdin, stdout } = createMockStreams();

    const result = await p.show({
      name: 'test',
      args: ['--verbose', 'my-project', '--output', 'dist'],
      stdin,
      stdout,
    });

    assert.strictEqual(result.name, 'my-project');
    assert.strictEqual(result.verbose, true);
    assert.strictEqual(result.output, 'dist');
  });
});

void describe('skip functionality', () => {
  void test('skips question with skip: true when provided via args', async () => {
    const p = create([], {
      username: {
        type: 'text',
        description: 'Username',
        message: 'Enter username',
        skip: true,
        default: 'default-user',
      },
    });
    const { stdin, stdout } = createMockStreams();

    const result = await p.show({
      name: 'test',
      args: ['--username', 'alice'],
      stdin,
      stdout,
    });

    assert.strictEqual(result.username, 'alice');
  });

  void test('uses default value for skipped question when not provided via args', async () => {
    const p = create([], {
      username: {
        type: 'text',
        description: 'Username',
        message: 'Enter username',
        skip: true,
        default: 'default-user',
      },
    });
    const { stdin, stdout } = createMockStreams();

    const result = await p.show({
      name: 'test',
      args: [],
      stdin,
      stdout,
    });

    assert.strictEqual(result.username, 'default-user');
  });

  void test('handles async skip function', async () => {
    const p = create([], {
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

    const result = await p.show({
      name: 'test',
      args: [],
      stdin,
      stdout,
    });

    assert.strictEqual(result.sugar, false);
  });
});

void describe('non-interactive mode', () => {
  void test('does not prompt for missing questions in non-interactive mode', async () => {
    const p = create([], {
      username: {
        type: 'text',
        description: 'Username',
        message: 'Enter username',
      },
      verbose: {
        type: 'confirm',
        description: 'Verbose output',
        message: 'Verbose?',
      },
    });
    const { stdin, stdout } = createMockStreams();

    const result = await p.show({
      name: 'test',
      args: ['--username', 'alice'],
      stdin,
      stdout,
    });

    assert.strictEqual(result.username, 'alice');
    assert.strictEqual(result.verbose, undefined);
  });

  void test('throws error for invalid args in non-interactive mode', async () => {
    const p = create([], {
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

    await assert.rejects(
      async () => {
        await p.show({
          name: 'test',
          args: ['--drink', 'invalid'],
          stdin,
          stdout,
        });
      },
      (error: Error) => {
        assert.match(error.message, /Invalid value for 'drink'/);
        return true;
      }
    );
  });
});

void describe('edge cases', () => {
  void test('handles empty args array', async () => {
    const p = create([], {
      username: {
        type: 'text',
        description: 'Username',
        message: 'Enter username',
      },
    });
    const { stdin, stdout } = createMockStreams();

    const result = await p.show({
      name: 'test',
      args: [],
      stdin,
      stdout,
    });

    assert.strictEqual(result.username, undefined);
  });

  void test('handles questions with no alias', async () => {
    const p = create([], {
      username: {
        type: 'text',
        description: 'Username',
        message: 'Enter username',
      },
    });
    const { stdin, stdout } = createMockStreams();

    const result = await p.show({
      name: 'test',
      args: ['--username', 'alice'],
      stdin,
      stdout,
    });

    assert.strictEqual(result.username, 'alice');
  });

  void test('handles multiple positionals with some missing', async () => {
    const p = create(['<required>', '[optional1]', '[optional2]'], {});
    const { stdin, stdout } = createMockStreams();

    const result = await p.show({
      name: 'test',
      args: ['value1'],
      stdin,
      stdout,
    });

    assert.strictEqual(result.required, 'value1');
    assert.strictEqual(result.optional1, undefined);
    assert.strictEqual(result.optional2, undefined);
  });

  void test('filters choices with skip function', async () => {
    const p = create([], {
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
    const { stdin, stdout } = createMockStreams();

    const result = await p.show({
      name: 'test',
      args: ['--drink', 'coffee'],
      stdin,
      stdout,
    });

    assert.strictEqual(result.drink, 'coffee');
  });

  void test('handles async default value', async () => {
    const p = create([], {
      username: {
        type: 'text',
        description: 'Username',
        message: 'Enter username',
        skip: true,
        default: async () => {
          await Promise.resolve();
          return 'async-default';
        },
      },
    });
    const { stdin, stdout } = createMockStreams();

    const result = await p.show({
      name: 'test',
      args: [],
      stdin,
      stdout,
    });

    assert.strictEqual(result.username, 'async-default');
  });

  void test('handles spinner questions in args (ignored in non-interactive mode)', async () => {
    const p = create([], {
      data: {
        type: 'spinner',
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

    const result = await p.show({
      name: 'test',
      args: [],
      stdin,
      stdout,
    });

    // Spinner should not be processed in non-interactive mode
    assert.strictEqual(result.data, undefined);
  });
});

void describe('complex validation', () => {
  void test('validates with function returning boolean', async () => {
    const p = create([], {
      age: {
        type: 'text',
        description: 'Age',
        message: 'Enter age',
        validate: (value) => !isNaN(Number(value)) && Number(value) > 0,
      },
    });
    const { stdin, stdout } = createMockStreams();

    const result = await p.show({
      name: 'test',
      args: ['--age', '25'],
      stdin,
      stdout,
    });

    assert.strictEqual(result.age, '25');
  });

  void test('fails validation with function returning false', async () => {
    const p = create([], {
      age: {
        type: 'text',
        description: 'Age',
        message: 'Enter age',
        validate: (value) => !isNaN(Number(value)) && Number(value) > 0,
      },
    });
    const { stdin, stdout } = createMockStreams();

    await assert.rejects(
      async () => {
        await p.show({
          name: 'test',
          args: ['--age', 'invalid'],
          stdin,
          stdout,
        });
      },
      (error: Error) => {
        assert.match(error.message, /Invalid value for 'age'/);
        return true;
      }
    );
  });

  void test('validates multiselect with custom rule', async () => {
    const p = create([], {
      tags: {
        type: 'multiselect',
        description: 'Tags',
        message: 'Select tags',
        choices: [
          { title: 'A', value: 'a' },
          { title: 'B', value: 'b' },
          { title: 'C', value: 'c' },
        ],
        validate: (value) =>
          value.length <= 2 ? true : 'Select at most 2 tags',
      },
    });
    const { stdin, stdout } = createMockStreams();

    await assert.rejects(
      async () => {
        await p.show({
          name: 'test',
          args: ['--tags', 'a', '--tags', 'b', '--tags', 'c'],
          stdin,
          stdout,
        });
      },
      (error: Error) => {
        assert.match(error.message, /Select at most 2 tags/);
        return true;
      }
    );
  });
});
