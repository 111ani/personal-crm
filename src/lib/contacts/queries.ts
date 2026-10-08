import "server-only";

import { and, asc, count, desc, eq, ilike } from "drizzle-orm";

import { db } from "@/db";
import { contacts, notes } from "@/db/schema";

export type ContactListItem = Pick<
  typeof contacts.$inferSelect,
  "id" | "name" | "about" | "phone" | "email"
>;

// Escape LIKE wildcards so the user's input is matched literally
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Lists contacts sorted by name. Each word of the query must occur in the
 * name, so "Смирнова Анна" finds "Анна Смирнова".
 */
export async function listContacts(query: string): Promise<ContactListItem[]> {
  const words = query.trim().split(/\s+/).filter(Boolean).slice(0, 5);
  const filters = words.map((word) =>
    ilike(contacts.name, `%${escapeLike(word)}%`),
  );

  return db
    .select({
      id: contacts.id,
      name: contacts.name,
      about: contacts.about,
      phone: contacts.phone,
      email: contacts.email,
    })
    .from(contacts)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(asc(contacts.name), asc(contacts.id));
}

export async function countContacts(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(contacts);
  return row?.value ?? 0;
}

export async function getContactWithNotes(id: string) {
  const [contact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, id))
    .limit(1);

  if (!contact) {
    return null;
  }

  const contactNotes = await db
    .select()
    .from(notes)
    .where(eq(notes.contactId, id))
    .orderBy(desc(notes.createdAt), desc(notes.id));

  return { contact, notes: contactNotes };
}
