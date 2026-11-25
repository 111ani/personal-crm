// Helpers that put rows straight into the test database

import { sql, type SQL } from "drizzle-orm";

import { getDb } from "@/db";
import {
  contactCheckIns,
  contactGroups,
  contacts,
  groups,
  notes,
} from "@/db/schema";
import type { ContactFrequency } from "@/lib/contacts/frequency";

// A moment for a row: an exact date or an expression on the database clock
type Moment = Date | SQL;

/** A moment in the past by the database clock: `ago("15 days")` */
export function ago(interval: string): SQL {
  return sql`now() - ${interval}::interval`;
}

/** `days` days before today at the given time of day: `atDaysAgo(7, "23:50")` */
export function atDaysAgo(days: number, time: string): SQL {
  return sql`date_trunc('day', now()) - make_interval(days => ${days}) + ${time}::interval`;
}

/**
 * The start of the day `interval` away from today by the database clock:
 * `dayFromToday("7 days")` is the due date a week from now
 */
export async function dayFromToday(interval: string): Promise<Date> {
  // As seconds: a raw query returns timestamps as text, not as dates
  const { rows } = await getDb().execute<{ seconds: string | number }>(
    sql`select extract(epoch from date_trunc('day', now() + ${interval}::interval)) as seconds`,
  );
  return new Date(Number(rows[0].seconds) * 1000);
}

/** A contact with a saved frequency; by default it was set just now */
export async function insertContactWithFrequency(
  name: string,
  {
    frequency,
    days = null,
    setAt = sql`now()`,
  }: { frequency: ContactFrequency; days?: number | null; setAt?: Moment },
): Promise<string> {
  const [row] = await getDb()
    .insert(contacts)
    .values({
      name,
      contactFrequency: frequency,
      contactFrequencyDays: days,
      contactFrequencySetAt: setAt,
    })
    .returning({ id: contacts.id });
  return row.id;
}

export async function insertNote(
  contactId: string,
  createdAt: Moment = sql`now()`,
) {
  await getDb()
    .insert(notes)
    .values({ contactId, body: "Созвонились", createdAt });
}

export async function insertCheckIn(
  contactId: string,
  createdAt: Moment = sql`now()`,
) {
  await getDb().insert(contactCheckIns).values({ contactId, createdAt });
}

/**
 * A contact already in "Пора связаться": "Раз в неделю" set a month ago and
 * the last note `lastNoteAgo` ago. The default 15 days is 8 days overdue
 */
export async function insertDueContact(name: string, lastNoteAgo = "15 days") {
  const contactId = await insertContactWithFrequency(name, {
    frequency: "week",
    setAt: ago("1 month"),
  });
  await insertNote(contactId, ago(lastNoteAgo));
  return contactId;
}

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
