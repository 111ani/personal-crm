// Runs before every test file; the hooks below run before every test.

import { beforeEach, vi } from "vitest";

import { getDb } from "@/db";

import { emptyTestDatabase } from "./test-database";

// Cache purging only works inside a running Next.js
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

beforeEach(async () => {
  // The app's own connection pool: the same database the code under test uses
  await emptyTestDatabase(getDb().$client, "_test");
});
