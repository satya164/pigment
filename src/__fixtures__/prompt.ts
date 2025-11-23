import { create } from '../index.ts';

export const prompt = create(['<name>', '[directory]'], {
  username: {
    type: 'text',
    alias: 'u',
    description: 'Name of the user',
    message: 'What is your name?',
    default: (): string => {
      const answers = prompt.read();

      if (answers.name != null) {
        return answers.name;
      }

      return 'John Doe';
    },
    validate: (value) => value.length > 3,
    required: true,
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
    required: true,
  },
  adult: {
    type: 'confirm',
    description: 'Whether the user is an adult',
    message: 'Are you over 18?',
    default: false,
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
    default: 'tea',
    required: true,
  },
  sugar: {
    type: 'confirm',
    description: 'Whether the user likes sugar in their coffee',
    message: 'Do you like your coffee with sugar?',
    skip: async (): Promise<boolean> => {
      await Promise.resolve();

      const answers = prompt.read();

      return answers.drink !== 'coffee';
    },
    required: true,
  },
  animal: {
    type: 'multiselect',
    description: 'Animals that the user likes',
    message: 'Which animals do you like?',
    choices: [{ title: 'Otter', value: 'otter' }],
    validate: (value) =>
      value.length > 0 ? true : 'Please select at least one animal',
    default: ['otter'],
    required: true,
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
      {
        title: 'Avocado',
        value: 'avocado',
        skip: (): boolean => {
          const answers = prompt.read();

          return answers.drink !== 'coffee';
        },
      },
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

async function timeout(duration: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve('Timeout');
    }, duration);
  });
}
