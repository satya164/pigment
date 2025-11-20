import { recommended, typechecked } from 'eslint-config-satya164';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig(
  recommended,
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
