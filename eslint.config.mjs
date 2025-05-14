import { recommended, typechecked, vitest } from 'eslint-config-satya164';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig(
  // The base config
  recommended,
  vitest,
  typechecked,

  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },

    rules: {
      'import-x/extensions': ['error', 'ignorePackages'],
    },
  },

  globalIgnores(['**/node_modules/', '**/lib/'])
);
