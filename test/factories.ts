// Helpers that put rows straight into the test database

import { getDb } from "@/db";
import { contactGroups, contacts, groups } from "@/db/schema";

export async function insertContact(name: string): Promise<string> {
  const [row] = await getDb()
    .insert(contacts)
    .values({ name })
    .returning({ id: contacts.id });
  return row.id;
}

export async function insertGroup(name: string): Promise<string> {
  const [row] = await getDb()
    .insert(groups)
    .values({ name })
    .returning({ id: groups.id });
  return row.id;
}

export async function addToGroup(contactId: string, groupId: string) {
  await getDb().insert(contactGroups).values({ contactId, groupId });
}

/** A group with the given people, who are created on the way; returns ids */
export async function insertGroupWithContacts(
  name: string,
  contactNames: string[],
) {
  const groupId = await insertGroup(name);
  const contactIds: string[] = [];
  for (const contactName of contactNames) {
    const contactId = await insertContact(contactName);
    await addToGroup(contactId, groupId);
    contactIds.push(contactId);
  }
  return { groupId, contactIds };
}
