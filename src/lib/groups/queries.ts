import "server-only";

import { and, count, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { contactGroups, contacts, groups } from "@/db/schema";

export type GroupWithCount = {
  id: string;
  name: string;
  // How many contacts are in the group
  contactCount: number;
};

// Russian alphabet, letter case aside: "семья" goes before "Теннис"
const byName = new Intl.Collator("ru-RU", { sensitivity: "base" });

/**
 * All groups by alphabet with the number of people in each, in one query.
 * Sorted here, not in the database: the order then does not depend on how
 * the database server was set up
 */
export async function listGroups(ownerId: string): Promise<GroupWithCount[]> {
  const rows = await getDb()
    .select({
      id: groups.id,
      name: groups.name,
      contactCount: count(contacts.id),
    })
    .from(groups)
    .leftJoin(contactGroups, eq(contactGroups.groupId, groups.id))
    .leftJoin(
      contacts,
      and(
        eq(contacts.id, contactGroups.contactId),
        eq(contacts.ownerId, ownerId),
      ),
    )
    .where(eq(groups.ownerId, ownerId))
    .groupBy(groups.id);

  return rows.sort(
    (a, b) => byName.compare(a.name, b.name) || a.id.localeCompare(b.id),
  );
}
