// Unit tests colocated as *.spec.ts across apps/ and libs/ — see .claude/agents/testing.md.
// @hebcal/core and its deps are ESM-only: compile them to CJS for Jest (Node 22 loads them natively at runtime).
const esmOnly = ['@hebcal', 'quick-lru', 'temporal-polyfill', 'temporal-utils'];

module.exports = {
  rootDir: '.',
  roots: ['<rootDir>/apps', '<rootDir>/libs'],
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'mjs', 'cjs', 'json'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': 'ts-jest',
    '^.+\\.m?js$': [
      'ts-jest',
      {
        tsconfig: { allowJs: true, module: 'commonjs' },
        isolatedModules: true,
      },
    ],
  },
  transformIgnorePatterns: [`/node_modules/(?!(${esmOnly.join('|')})/)`],
  moduleNameMapper: {
    '^@app/(auth-kernel|otel|queue-contracts|queue-client|kafka-contracts|kafka-client|users-schema)$':
      '<rootDir>/libs/$1/src',
    '^@app/(auth-kernel|otel|queue-contracts|queue-client|kafka-contracts|kafka-client|users-schema)/(.*)$':
      '<rootDir>/libs/$1/src/$2',
  },
};
