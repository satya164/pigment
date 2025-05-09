import { recommended, vitest } from 'eslint-config-satya164';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig(
  // The base config
  recommended,
  vitest,

  {
    rules: {
      'import-x/extensions': ['error', 'always'],
    },
  },

  globalIgnores(['**/node_modules/', '**/lib/'])
);
