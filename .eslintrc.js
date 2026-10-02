module.exports = {
  root: true,
  extends: '@react-native-community',
  plugins: ['simple-import-sort'],
  ignorePatterns: ['production/', 'node_modules/'],
  rules: {
    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error',
  },
};
