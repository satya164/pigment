import { expectTypeOf } from 'expect-type';
import { create } from './index.ts';

const pigment = create(['<name>', '[directory]'], {
  username: {
    type: 'text',
    description: 'Name of the user',
    message: 'What is your name?',
    initial: 'John Doe',
    validate: (value) => value.length > 3,
  },
  pokemon: {
    type: 'spinner',
    description: 'Pokémon data',
    message: 'Looking for Pokémon…',
    task: async function* () {
      await timeout(500);

      yield { message: 'Throwing Pokéball…' };

      await timeout(1000);

      const mimikyu = {
        name: 'Mimikyu',
        types: ['ghost', 'fairy'],
        abilities: ['disguise', 'pickpocket'],
      };

      const bulbasaur = {
        name: 'Bulbasaur',
        types: ['grass', 'poison'],
        abilities: ['overgrow', 'chlorophyll'],
      };

      const pokemon = Math.random() > 0.5 ? mimikyu : bulbasaur;

      return {
        message: `Caught ${pokemon.name}`,
        value: pokemon,
      };
    },
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
    initial: false,
  },
  drink: {
    type: 'select',
    description: 'Favorite drink of the user',
    message: 'What is your favorite drink?',
    choices: [
      {
        title: 'Coffee',
        description: 'A hot drink made from roasted coffee beans',
        value: 'coffee',
      },
      {
        title: 'Tea',
        description:
          'A hot drink made by infusing dried tea leaves in boiling water',
        value: 'tea',
      },
    ],
    initial: 'tea',
  },
  sugar: {
    description: 'Whether the user likes sugar in their coffee',
    async prompt() {
      await Promise.resolve();

      const answers = pigment.read();

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
    validate: (value) =>
      value.length > 0 ? true : 'Please select at least one animal',
    initial: ['otter'],
  },
  fruits: {
    type: 'multiselect',
    description: 'Fruits that the user likes',
    message: 'Which fruits do you like?',
    choices: [
      {
        title: 'Apple',
        description: 'An apple a day keeps the doctor away',
        value: 'apple',
      },
      { title: 'Banana', value: 'banana' },
      { title: 'Orange', value: 'orange' },
    ],
    initial: ['apple', 'banana'],
  },
  feeling: {
    type: 'text',
    description: 'How the user is feeling',
    message: 'How are you feeling today?',
  },
});

const result = await pigment.show({
  onCancel: () => {
    process.stdout.write('Prompt cancelled\n');
    process.exit(0);
  },
});

expectTypeOf(result).toEqualTypeOf<
  Readonly<{
    name: string;
    directory?: string;
    username: string;
    planet: 'earth';
    pokemon: {
      name: string;
      types: string[];
      abilities: string[];
    };
    adult: boolean;
    drink: 'coffee' | 'tea';
    sugar: boolean | undefined;
    animal: 'otter'[];
    fruits: ('apple' | 'banana' | 'orange')[];
    feeling: string;
  }>
>();

async function timeout(duration: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve('Timeout');
    }, duration);
  });
}
