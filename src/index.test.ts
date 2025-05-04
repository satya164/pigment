import { expectTypeOf } from 'expect-type';
import { create } from './index.ts';

const prompt = create({
  name: {
    type: 'text',
    message: 'What is your name?',
    validate: (value) => value.length > 0,
  },
  age: {
    type: 'confirm',
    message: 'Are you over 18?',
  },
  drink: {
    type: 'select',
    message: 'What is your favorite drink?',
    choices: ['coffee', 'tea'],
  },
  reason: async () => {
    const answers = prompt.read();

    if (answers.drink === 'coffee') {
      return {
        type: 'confirm',
        message: 'Do you like your coffee with sugar?',
      };
    }

    return null;
  },
  fruits: {
    type: 'multiselect',
    message: 'Which fruits do you like?',
    choices: ['apple', 'banana', 'orange'],
  },
});

const result = await prompt.show();

console.log(result);

expectTypeOf(result).toEqualTypeOf<
  Readonly<{
    name: string;
    age: boolean;
    drink: 'coffee' | 'tea';
    reason: boolean | undefined;
    fruits: ('apple' | 'banana' | 'orange')[];
  }>
>();
