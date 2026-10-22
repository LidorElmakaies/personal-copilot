// Unit tests colocated as *.spec.{ts,js} under src/ — see .claude/agents/testing.md.
// jest-expo's environment is already Node's (+ the 'react-native' export condition), so specs may set process.env.TZ.
const expoPreset = require('jest-expo/jest-preset');

// ESM-only under Jest's 'react-native' condition — @hebcal/core and its deps, immer (Redux
// Toolkit's) and react-redux (component specs' <Provider>): compile them too, on top of jest-expo's
// RN/expo list.
const esmOnly = [
  '@hebcal',
  'quick-lru',
  'temporal-polyfill',
  'temporal-utils',
  'immer',
  'react-redux',
];
const [nodeModules, ...otherIgnores] = expoPreset.transformIgnorePatterns;

module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/src'], // not app/ (routes) or e2e/ (Playwright)
  testRegex: '\\.spec\\.[jt]s$',
  transformIgnorePatterns: [
    nodeModules.replace('(?!(', `(?!(${esmOnly.join('|')}|`),
    ...otherIgnores,
  ],
  moduleNameMapper: {
    // its package root exports only an "import" condition, which Jest's resolver doesn't use
    '^@hebcal/core$': '@hebcal/core/dist/esm/index',
  },
};
