import { expectTypeOf } from 'expect-type';
import { prompt } from './prompt.ts';

const result = await prompt.show({
  name: 'pigment-demo',
  description: 'A demo of pigment CLI prompt',
  version: '0.42.0',
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
    fruits: ('apple' | 'avocado' | 'banana' | 'orange')[];
    feeling: string;
  }>
>();
