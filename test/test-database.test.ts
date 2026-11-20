import { sql } from "drizzle-orm";
import { expect, test } from "vitest";

import { getDb } from "@/db";

test("тесты работают в отдельной базе", async () => {
  const { rows } = await getDb().execute<{
    name: string;
    has_contacts: boolean;
  }>(
    sql`select current_database() as name, to_regclass('public.contacts') is not null as has_contacts`,
  );

  expect(rows[0].name.endsWith("_test")).toBe(true);
  expect(rows[0].has_contacts).toBe(true);
});
