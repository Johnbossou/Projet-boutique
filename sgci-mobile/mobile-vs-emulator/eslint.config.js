// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Le setup Jest est un .js, pas un *.test.js : sans ce bloc, le global
    // `jest` n'est pas déclaré et le lint s'arrête sur `no-undef`.
    files: ['jest.setup.js', 'jest.config.js'],
    languageOptions: {
      globals: {
        jest: 'readonly',
      },
    },
  },
  {
    rules: {
      'react/no-unescaped-entities': 'off',
    },
  },
]);
