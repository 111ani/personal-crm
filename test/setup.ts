// Runs before every test file; the hooks below run before every test.

import { beforeEach, vi } from "vitest";

import { getDb } from "@/db";

import { ensureTestOwner } from "./factories";
import { emptyTestDatabase } from "./test-database";

// Cache purging only works inside a running Next.js
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Action tests model a signed-in user. Browser and authentication tests
// exercise the real session checks separately.
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: () => ensureTestOwner(),
}));

beforeEach(async () => {
  // The app's own connection pool: the same database the code under test uses
  await emptyTestDatabase(getDb().$client, "_test");
});
