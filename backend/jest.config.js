// Unit tests colocated as *.spec.ts across apps/ and libs/ — see .claude/agents/testing.md.
module.exports = {
  rootDir: '.',
  roots: ['<rootDir>/apps', '<rootDir>/libs'],
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testEnvironment: 'node',
  transform: { '^.+\\.ts$': 'ts-jest' },
  moduleNameMapper: {
    '^@app/(auth-kernel|otel|build-info)$': '<rootDir>/libs/$1/src',
    '^@app/(auth-kernel|otel|build-info)/(.*)$': '<rootDir>/libs/$1/src/$2',
  },
};
