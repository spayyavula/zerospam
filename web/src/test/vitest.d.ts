// Augment web's local copy of `vitest` (web/node_modules/vitest@2.1.9) with
// the jest-dom matcher types. We replicate the module augmentation that
// `@testing-library/jest-dom/vitest` ships, but in this file the relative
// resolution of `vitest` lands on web's installation rather than the root
// monorepo's, which is what the test files actually import from.
import 'vitest';
import { type TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'vitest' {
  interface Assertion<T = any> extends TestingLibraryMatchers<any, T> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<any, any> {}
}
