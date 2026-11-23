import { expect, test } from "vitest";

// Deliberately failing: checks that the protection of main blocks a PR with
// red CI. The PR with this file is closed without merging.
test("fails on purpose to check the protection of main", () => {
  expect(1 + 1).toBe(3);
});
