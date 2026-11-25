import { drizzle } from "drizzle-orm/node-postgres";
import { expect, test } from "vitest";

import { getDb } from "@/db";
import { authUsers, contacts, groups, notes } from "@/db/schema";

import { seedDatabase } from "./seed-db";

test("Seed requires a valid owner email before writing any records", async () => {
  const db = drizzle(getDb().$client);
  await expect(seedDatabase(db, undefined, false)).rejects.toThrow(
    /CRM_OWNER_EMAIL/,
  );
  await expect(seedDatabase(db, "invalid", false)).rejects.toThrow(
    /CRM_OWNER_EMAIL/,
  );
  expect(await db.select().from(authUsers)).toEqual([]);
  expect(await db.select().from(contacts)).toEqual([]);
});

test("Demo data belongs to the configured owner", async () => {
  const db = drizzle(getDb().$client);
  await db
    .insert(authUsers)
    .values({ id: "other", name: "Other", email: "other@example.test" });
  await seedDatabase(db, " OWNER@EXAMPLE.TEST ", false);

  const users = await db.select().from(authUsers);
  const owner = users.find((user) => user.email === "owner@example.test");
  expect(owner?.emailVerified).toBe(false);
  const demoContacts = await db.select().from(contacts);
  expect(demoContacts).toHaveLength(1000);
  expect(new Set(demoContacts.map(({ ownerId }) => ownerId))).toEqual(
    new Set([owner?.id]),
  );
  const demoGroups = await db.select().from(groups);
  expect(demoGroups).toHaveLength(6);
  expect(new Set(demoGroups.map(({ ownerId }) => ownerId))).toEqual(
    new Set([owner?.id]),
  );
  const ids = new Set(demoContacts.map(({ id }) => id));
  const demoNotes = await db.select().from(notes);
  expect(demoNotes.length).toBeGreaterThan(0);
  expect(demoNotes.every(({ contactId }) => ids.has(contactId))).toBe(true);
});

test("Reset replaces only the demo owner's records", async () => {
  const db = drizzle(getDb().$client);
  await db.insert(authUsers).values([
    { id: "owner", name: "Owner", email: "owner@example.test" },
    { id: "other", name: "Other", email: "other@example.test" },
  ]);
  const [ownerContact, otherContact] = await db
    .insert(contacts)
    .values([
      { ownerId: "owner", name: "Old owner contact" },
      { ownerId: "other", name: "Other contact" },
    ])
    .returning();
  const [otherGroup] = await db
    .insert(groups)
    .values({ ownerId: "other", name: "Other group" })
    .returning();
  const [otherNote] = await db
    .insert(notes)
    .values({ contactId: otherContact.id, body: "Other note" })
    .returning();

  await seedDatabase(db, "owner@example.test", false);
  expect(await db.select().from(contacts)).toHaveLength(2);
  await seedDatabase(db, "owner@example.test", true);

  const after = await db.select().from(contacts);
  expect(after).toHaveLength(1001);
  expect(after).toContainEqual(otherContact);
  expect(after).not.toContainEqual(ownerContact);
  expect(await db.select().from(groups)).toContainEqual(otherGroup);
  expect(await db.select().from(notes)).toContainEqual(otherNote);
});
