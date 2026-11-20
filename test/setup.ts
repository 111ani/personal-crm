// Runs before every test file; the hooks below run before every test.

import { sql } from "drizzle-orm";
import { beforeEach, vi } from "vitest";

import { getDb } from "@/db";

// Cache purging only works inside a running Next.js
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

beforeEach(async () => {
  const db = getDb();
  const { rows: name } = await db.execute<{ name: string }>(
    sql`select current_database() as name`,
  );
  // The guard: never wipe anything but the test database
  if (!name[0].name.endsWith("_test")) {
    throw new Error(
      `Refusing to clean database "${name[0].name}": tests run only on a database ending in _test`,
    );
  }

  const { rows: tables } = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  if (tables.length > 0) {
    const list = tables.map((table) => `"${table.tablename}"`).join(", ");
    await db.execute(sql.raw(`truncate table ${list} restart identity cascade`));
  }
});
