/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.test.tsx'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: { esModuleInterop: true } }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^next/navigation$': '<rootDir>/tests/mocks/nextNavigation.ts',
  },
}
