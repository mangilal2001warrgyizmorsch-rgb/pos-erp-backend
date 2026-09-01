export default {
  testEnvironment: 'node',
  transform: {},
  setupFilesAfterEnv: [],
  testTimeout: 10000,
  verbose: true,
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
