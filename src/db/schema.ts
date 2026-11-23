import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  contactFrequencies,
  maxFrequencyDays,
  minFrequencyDays,
} from "../lib/contacts/frequency.ts";

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    // Who this person is: role, occupation, relation
    about: text("about"),
    howWeMet: text("how_we_met"),
    phone: text("phone"),
    email: text("email"),
    // How often to keep in touch; NULL - not set
    contactFrequency: text("contact_frequency", { enum: contactFrequencies }),
    // N for the "days" frequency; NULL for the others
    contactFrequencyDays: integer("contact_frequency_days"),
    // When the frequency was set or changed: the due date counts from it
    // while there are no notes and check-ins
    contactFrequencySetAt: timestamp("contact_frequency_set_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("contacts_name_idx").on(table.name),
    check(
      "contacts_contact_frequency_check",
      sql`${table.contactFrequency} in (${sql.raw(
        contactFrequencies.map((frequency) => `'${frequency}'`).join(", "),
      )})`,
    ),
    check(
      "contacts_contact_frequency_set_at_check",
      sql`(${table.contactFrequency} is null) = (${table.contactFrequencySetAt} is null)`,
    ),
    check(
      "contacts_contact_frequency_days_check",
      sql`(${table.contactFrequency} is not distinct from 'days') = (${table.contactFrequencyDays} is not null) and ${table.contactFrequencyDays} between ${sql.raw(String(minFrequencyDays))} and ${sql.raw(String(maxFrequencyDays))}`,
    ),
  ],
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("notes_contact_id_created_at_idx").on(
      table.contactId,
      table.createdAt,
    ),
  ],
);

// "Связались" check-ins: one row per tick, so undo deletes exactly that row
export const contactCheckIns = pgTable(
  "contact_check_ins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("contact_check_ins_contact_id_created_at_idx").on(
      table.contactId,
      table.createdAt,
    ),
  ],
);

// Groups of contacts ("Семья", "Теннис"): circles of people. Names are unique
// regardless of letter case: the database itself refuses "Теннис" next to "теннис"
export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("groups_name_lower_idx").on(sql`lower(${table.name})`),
  ],
);

// Which contact is in which group: many to many. A link goes away together
// with its contact or its group
export const contactGroups = pgTable(
  "contact_groups",
  {
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.contactId, table.groupId] }),
    // For "all contacts of a group"
    index("contact_groups_group_id_idx").on(table.groupId),
  ],
);

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type NewContactCheckIn = typeof contactCheckIns.$inferInsert;
export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
export type NewContactGroup = typeof contactGroups.$inferInsert;
