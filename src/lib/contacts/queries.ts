import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  isNotNull,
  sql,
} from "drizzle-orm";

import { db } from "@/db";
import { contactCheckIns, contacts, notes } from "@/db/schema";
import type { ContactFrequency } from "@/lib/contacts/frequency";

export type ContactListItem = Pick<
  typeof contacts.$inferSelect,
  "id" | "name" | "about" | "phone" | "email"
>;

export type DueContact = {
  id: string;
  name: string;
  frequency: ContactFrequency;
  overdueDays: number;
};

/** When to get in touch with a contact that has a frequency, for the card */
export type ContactDue = {
  dueAt: Date;
  isDue: boolean;
  overdueDays: number;
  lastCheckInAt: Date | null;
  checkedInToday: boolean;
  // Database clock: decides whether dates need the year
  now: Date;
};

// "Today" is a calendar day by the database clock (UTC), like the other dates
export const startOfToday = sql`date_trunc('day', now())`;

// Months and years are calendar ones: Postgres adds them by the calendar
const frequencyIntervals: Record<ContactFrequency, string> = {
  week: "7 days",
  month: "1 month",
  quarter: "3 months",
  year: "1 year",
};

const frequencyInterval = sql`case ${contacts.contactFrequency} ${sql.join(
  Object.entries(frequencyIntervals).map(
    ([frequency, interval]) => sql`when ${frequency} then ${interval}::interval`,
  ),
  sql` `,
)} end`;

const lastNoteAt = sql`(select max(${notes.createdAt}) from ${notes} where ${notes.contactId} = ${contacts.id})`;

const lastCheckInAt = sql`(select max(${contactCheckIns.createdAt}) from ${contactCheckIns} where ${contactCheckIns.contactId} = ${contacts.id})`;

/**
 * Contacts with a frequency and the moment they are due: the interval after
 * the latest note or check-in, or after the frequency was set if there were
 * neither. The one rule for the home block and the card, so both always show
 * the same overdue.
 */
const contactsWithDue = db
  .select({
    id: contacts.id,
    name: contacts.name,
    // Never NULL here: contacts without a frequency are filtered out below
    frequency: sql<ContactFrequency>`${contacts.contactFrequency}`.as(
      "frequency",
    ),
    lastCheckInAt: sql<Date | null>`${lastCheckInAt}`
      .mapWith(contactCheckIns.createdAt)
      .as("last_check_in_at"),
    dueAt: sql<Date>`coalesce(greatest(${lastNoteAt}, ${lastCheckInAt}), ${contacts.contactFrequencySetAt}) + ${frequencyInterval}`
      .mapWith(contacts.contactFrequencySetAt)
      .as("due_at"),
  })
  .from(contacts)
  .where(isNotNull(contacts.contactFrequency))
  .as("contacts_with_due");

const isDue = sql<boolean>`${contactsWithDue.dueAt} <= now()`;

// Full days since the due moment; negative while it has not come yet
const overdueDays = sql<number>`floor(extract(epoch from now() - ${contactsWithDue.dueAt}) / 86400)::int`;

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

/** Contacts whose due moment has come: the longest overdue first */
export async function listDueContacts(): Promise<DueContact[]> {
  return db
    .select({
      id: contactsWithDue.id,
      name: contactsWithDue.name,
      frequency: contactsWithDue.frequency,
      overdueDays,
    })
    .from(contactsWithDue)
    .where(isDue)
    .orderBy(
      asc(contactsWithDue.dueAt),
      asc(contactsWithDue.name),
      asc(contactsWithDue.id),
    );
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

  const [contactNotes, dueRows] = await Promise.all([
    db
      .select()
      .from(notes)
      .where(eq(notes.contactId, id))
      .orderBy(desc(notes.createdAt), desc(notes.id)),
    // No row if the contact has no frequency
    db
      .select({
        dueAt: contactsWithDue.dueAt,
        isDue,
        overdueDays,
        lastCheckInAt: contactsWithDue.lastCheckInAt,
        checkedInToday: sql<boolean>`coalesce(${contactsWithDue.lastCheckInAt} >= ${startOfToday}, false)`,
        now: sql<Date>`now()`.mapWith(contacts.createdAt),
      })
      .from(contactsWithDue)
      .where(eq(contactsWithDue.id, id)),
  ]);
  const due: ContactDue | null = dueRows[0] ?? null;

  return { contact, notes: contactNotes, due };
}
