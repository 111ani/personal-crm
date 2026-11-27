// The e2e database straight from the tests: clean it and put the starting
// data in. The app under test works with the same database.

import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { seedDatabase } from "../scripts/seed-db";
import {
  authSessions,
  authUsers,
  contactGroups,
  contacts,
  groups,
  magicLinkRequests,
  notes,
} from "../src/db/schema";
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

export function ageOldestLink(email: string, minutes: number) {
  return withPool(async (pool) => {
    await drizzle(pool)
      .update(magicLinkRequests)
      .set({
        issuedAt: sql`clock_timestamp() - make_interval(mins => ${minutes})`,
      })
      .where(
        sql`${magicLinkRequests.tokenHash} = (select token_hash from magic_link_requests where email = ${email} order by issued_at limit 1)`,
      );
  });
}

export function setSessionAge(email: string, days: number) {
  return withPool(async (pool) => {
    await drizzle(pool)
      .update(authSessions)
      .set({
        createdAt: sql`now() - make_interval(days => ${days})`,
        updatedAt: sql`now() - make_interval(days => ${days})`,
        expiresAt: sql`now() + make_interval(days => ${30 - days})`,
      })
      .where(
        sql`${authSessions.userId} = (select id from auth_user where email = ${email})`,
      );
  });
}

export function seedDemoData(email: string) {
  return withPool(async (pool) => {
    const db = drizzle(pool);
    await seedDatabase(db, email, false);
    const [sample] = await db
      .select({
        id: contacts.id,
        name: contacts.name,
        note: notes.body,
        group: groups.name,
      })
      .from(contacts)
      .innerJoin(notes, eq(notes.contactId, contacts.id))
      .innerJoin(contactGroups, eq(contactGroups.contactId, contacts.id))
      .innerJoin(groups, eq(groups.id, contactGroups.groupId))
      .limit(1);
    return sample;
  });
}

async function fixtureOwner(db: NodePgDatabase, email: string) {
  await db
    .insert(authUsers)
    .values({ id: randomUUID(), name: email, email })
    .onConflictDoNothing({ target: authUsers.email });
  const [user] = await db
    .select({ id: authUsers.id })
    .from(authUsers)
    .where(eq(authUsers.email, email));
  return user.id;
}

export async function insertContacts(email: string, names: string[]) {
  return withPool(async (pool) => {
    const db = drizzle(pool);
    const ownerId = await fixtureOwner(db, email);
    return db
      .insert(contacts)
      .values(names.map((name) => ({ name, ownerId })))
      .returning({ id: contacts.id });
  });
}

export function setBirthdayRelativeToToday(contactId: string, days: number) {
  const date = sql`(current_date + ${days}::integer)`;
  return withPool(async (pool) => {
    await drizzle(pool)
      .update(contacts)
      .set({
        birthDay: sql`extract(day from ${date})`,
        birthMonth: sql`extract(month from ${date})`,
      })
      .where(eq(contacts.id, contactId));
  });
}

export function insertContactWithGroups(
  email: string,
  contactName: string,
  assignedGroupName: string,
  unassignedGroupName: string,
) {
  return withPool((pool) =>
    drizzle(pool).transaction(async (tx) => {
      const ownerId = await fixtureOwner(tx, email);
      const [contact] = await tx
        .insert(contacts)
        .values({ name: contactName, ownerId })
        .returning({ id: contacts.id });
      const [assignedGroup] = await tx
        .insert(groups)
        .values({ name: assignedGroupName, ownerId })
        .returning({ id: groups.id });
      await tx.insert(groups).values({ name: unassignedGroupName, ownerId });
      await tx
        .insert(contactGroups)
        .values({ contactId: contact.id, groupId: assignedGroup.id });
      return { contactId: contact.id, groupId: assignedGroup.id };
    }),
  );
}
