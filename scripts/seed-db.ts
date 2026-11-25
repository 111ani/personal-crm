import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import {
  authUsers,
  contactCheckIns,
  contactGroups,
  contacts,
  groups,
  notes,
} from "../src/db/schema.ts";
import { parseOwnerEmail } from "../src/lib/auth/email.ts";
import { generateSeedData } from "./seed-data.ts";

const CONTACT_COUNT = 1000;
const BATCH_SIZE = 500;

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function seedDatabase(
  db: NodePgDatabase,
  ownerEmail: string | undefined,
  reset: boolean,
) {
  const email = parseOwnerEmail(ownerEmail);
  if (!email) throw new Error("CRM_OWNER_EMAIL is required to seed demo data");

  return db.transaction(async (tx) => {
    await tx
      .insert(authUsers)
      .values({ id: randomUUID(), name: email, email })
      .onConflictDoNothing({ target: authUsers.email });
    const [owner] = await tx
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.email, email))
      .for("no key update");
    const ownerId = owner.id;
    const ownedContacts = eq(contacts.ownerId, ownerId);
    const ownedGroups = eq(groups.ownerId, ownerId);
    if (reset) {
      await tx.delete(contacts).where(ownedContacts);
      await tx.delete(groups).where(ownedGroups);
    } else {
      const [existing] = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(ownedContacts)
        .limit(1);
      if (existing) return null;
    }

    const [existingGroup] = await tx
      .select({ id: groups.id })
      .from(groups)
      .where(ownedGroups)
      .limit(1);
    const { contactRows, noteRows, checkInRows, groupRows, contactGroupRows } =
      generateSeedData(CONTACT_COUNT, new Date());

    for (const batch of chunk(contactRows, BATCH_SIZE)) {
      await tx
        .insert(contacts)
        .values(batch.map((row) => ({ ...row, ownerId })));
    }
    for (const batch of chunk(noteRows, BATCH_SIZE)) {
      await tx.insert(notes).values(batch);
    }
    for (const batch of chunk(checkInRows, BATCH_SIZE)) {
      await tx.insert(contactCheckIns).values(batch);
    }
    if (!existingGroup) {
      await tx
        .insert(groups)
        .values(groupRows.map((row) => ({ ...row, ownerId })));
      for (const batch of chunk(contactGroupRows, BATCH_SIZE)) {
        await tx.insert(contactGroups).values(batch);
      }
    }

    return {
      contacts: contactRows.length,
      notes: noteRows.length,
      checkIns: checkInRows.length,
      groups: existingGroup ? 0 : groupRows.length,
      memberships: existingGroup ? 0 : contactGroupRows.length,
    };
  });
}
