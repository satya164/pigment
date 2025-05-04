import { expectTypeOf } from 'expect-type';
import { create } from './index.ts';

const prompt = create({
  name: {
    type: 'text',
    message: 'What is your name?',
    validate: (value) => value.length > 0,
  },
  adult: {
    type: 'confirm',
    message: 'Are you over 18?',
  },
  drink: {
    type: 'select',
    message: 'What is your favorite drink?',
    choices: [
      { title: 'Coffee', value: 'coffee' },
      { title: 'Tea', value: 'tea' },
    ],
  },
  sugar: async () => {
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
    choices: [
      { title: 'Apple', value: 'apple' },
      { title: 'Banana', value: 'banana' },
      { title: 'Orange', value: 'orange' },
    ],
  },
});

const result = await prompt.show();

console.log(result);

expectTypeOf(result).toEqualTypeOf<
  Readonly<{
    name: string;
    adult: boolean;
    drink: 'coffee' | 'tea';
    sugar: boolean | undefined;
    fruits: ('apple' | 'banana' | 'orange')[];
  }>
>();
