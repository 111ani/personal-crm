// The e2e database straight from the tests: clean it and put the starting
// data in. The app under test works with the same database.

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { contactGroups, contacts, groups } from "../src/db/schema";
import { getE2eDatabaseUrl } from "../test/database-url";
import { emptyTestDatabase } from "../test/test-database";

async function withPool<T>(work: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: getE2eDatabaseUrl() });
  try {
    return await work(pool);
  } finally {
    await pool.end();
  }
}

/** Empties every table of the e2e database; never touches another one */
export function resetDatabase() {
  return withPool((pool) => emptyTestDatabase(pool, "_e2e"));
}

export async function insertContacts(names: string[]) {
  await withPool((pool) =>
    drizzle(pool)
      .insert(contacts)
      .values(names.map((name) => ({ name }))),
  );
}

export function insertContactWithGroups(
  contactName: string,
  assignedGroupName: string,
  unassignedGroupName: string,
) {
  return withPool((pool) =>
    drizzle(pool).transaction(async (tx) => {
      const [contact] = await tx
        .insert(contacts)
        .values({ name: contactName })
        .returning({ id: contacts.id });
      const [assignedGroup] = await tx
        .insert(groups)
        .values({ name: assignedGroupName })
        .returning({ id: groups.id });
      await tx.insert(groups).values({ name: unassignedGroupName });
      await tx
        .insert(contactGroups)
        .values({ contactId: contact.id, groupId: assignedGroup.id });
    }),
  );
}
