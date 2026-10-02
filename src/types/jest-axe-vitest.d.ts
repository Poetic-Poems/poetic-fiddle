// @types/jest-axe types `toHaveNoViolations` by augmenting `jest.Matchers`,
// which Vitest's `Assertion` stopped extending in Vitest 5. Augment Vitest's
// own interfaces instead, as @testing-library/jest-dom does for its matchers.
import "vitest";

declare module "vitest" {
  interface Assertion {
    toHaveNoViolations(): void;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}
