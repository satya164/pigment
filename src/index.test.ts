import { expectTypeOf } from 'expect-type';
import { create } from './index.ts';

const prompt = create('$0 <name>', {
  name: {
    type: 'text',
    description: 'Name of the user',
    message: 'What is your name?',
    validate: (value) => value.length > 3,
  },
  planet: {
    type: 'select',
    description: 'Planet of the user',
    message: 'Which planet do you live on?',
    choices: [{ title: 'Earth', value: 'earth' }],
  },
  adult: {
    type: 'confirm',
    description: 'Whether the user is an adult',
    message: 'Are you over 18?',
  },
  drink: {
    type: 'select',
    description: 'Favorite drink of the user',
    message: 'What is your favorite drink?',
    choices: [
      { title: 'Coffee', value: 'coffee' },
      { title: 'Tea', value: 'tea' },
    ],
  },
  sugar: {
    description: 'Whether the user likes sugar in their coffee',
    async prompt() {
      const answers = prompt.read();

      if (answers.drink === 'coffee') {
        return {
          type: 'confirm',
          message: 'Do you like your coffee with sugar?',
        };
      }

      return null;
    },
  },
  animal: {
    type: 'multiselect',
    description: 'Animals that the user likes',
    message: 'Which animals do you like?',
    choices: [{ title: 'Otter', value: 'otter' }],
  },
  fruits: {
    type: 'multiselect',
    description: 'Fruits that the user likes',
    message: 'Which fruits do you like?',
    choices: [
      { title: 'Apple', value: 'apple' },
      { title: 'Banana', value: 'banana' },
      { title: 'Orange', value: 'orange' },
    ],
  },
  feeling: {
    type: 'text',
    description: 'How the user is feeling',
    message: 'How are you feeling today?',
  },
});

const result = await prompt.show();

console.log(result);

expectTypeOf(result).toEqualTypeOf<
  Readonly<{
    name: string;
    planet: 'earth';
    adult: boolean;
    drink: 'coffee' | 'tea';
    sugar: boolean | undefined;
    animal: 'otter'[];
    fruits: ('apple' | 'banana' | 'orange')[];
    feeling: string;
  }>
>();
