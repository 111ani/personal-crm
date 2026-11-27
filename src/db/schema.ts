import { sql } from "drizzle-orm";
import {
  boolean,
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

export const authUsers = pgTable("auth_user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const authSessions = pgTable(
  "auth_session",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
  },
  (table) => [index("auth_session_user_idx").on(table.userId)],
);

export const authAccounts = pgTable(
  "auth_account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("auth_account_user_idx").on(table.userId)],
);

export const authVerifications = pgTable(
  "auth_verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("auth_verification_identifier_idx").on(table.identifier)],
);

export const magicLinkRequests = pgTable(
  "magic_link_requests",
  {
    tokenHash: text("token_hash").primaryKey(),
    email: text("email").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    current: boolean("current").notNull().default(true),
  },
  (table) => [
    index("magic_link_requests_email_issued_idx").on(
      table.email,
      table.issuedAt,
    ),
    uniqueIndex("magic_link_requests_current_email_idx")
      .on(table.email)
      .where(sql`${table.current}`),
  ],
);

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => authUsers.id),
    name: text("name").notNull(),
    // Who this person is: role, occupation, relation
    about: text("about"),
    howWeMet: text("how_we_met"),
    phone: text("phone"),
    email: text("email"),
    birthDay: integer("birth_day"),
    birthMonth: integer("birth_month"),
    birthYear: integer("birth_year"),
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
    index("contacts_owner_name_idx").on(table.ownerId, table.name),
    check(
      "contacts_birth_date_parts_check",
      sql`(${table.birthDay} is null) = (${table.birthMonth} is null) and (${table.birthYear} is null or ${table.birthDay} is not null)`,
    ),
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

// Group names are case-insensitively unique for each owner.
export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => authUsers.id),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("groups_owner_name_lower_idx").on(
      table.ownerId,
      sql`lower(${table.name})`,
    ),
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
