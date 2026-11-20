// Fills the database with test contacts.
//   pnpm db:seed          - only if the database has no contacts yet
//   pnpm db:seed --reset  - DELETES all contacts, notes, check-ins and groups, then seeds

import { existsSync } from "node:fs";

import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import {
  contactCheckIns,
  contactGroups,
  contacts,
  groups,
  notes,
} from "../src/db/schema.ts";
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

async function main() {
  if (existsSync(".env")) {
    process.loadEnvFile(".env");
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env");
  }

  const reset = process.argv.includes("--reset");
  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  try {
    const [{ value: existing }] = await db
      .select({ value: count() })
      .from(contacts);

    if (existing > 0 && !reset) {
      console.log(
        `The database already has ${existing} contacts, nothing was changed.\n` +
          `To replace them with test data run: pnpm db:seed --reset`,
      );
      return;
    }

    // Groups the user made by hand must not clash with the test ones: they
    // are replaced only on --reset
    const [{ value: existingGroups }] = await db
      .select({ value: count() })
      .from(groups);
    const seedGroups = reset || existingGroups === 0;

    const { contactRows, noteRows, checkInRows, groupRows, contactGroupRows } =
      generateSeedData(CONTACT_COUNT, new Date());

    await db.transaction(async (tx) => {
      if (reset) {
        await tx.delete(contactGroups);
        await tx.delete(groups);
        await tx.delete(contactCheckIns);
        await tx.delete(notes);
        await tx.delete(contacts);
      }
      for (const batch of chunk(contactRows, BATCH_SIZE)) {
        await tx.insert(contacts).values(batch);
      }
      for (const batch of chunk(noteRows, BATCH_SIZE)) {
        await tx.insert(notes).values(batch);
      }
      for (const batch of chunk(checkInRows, BATCH_SIZE)) {
        await tx.insert(contactCheckIns).values(batch);
      }
      if (seedGroups) {
        await tx.insert(groups).values(groupRows);
        for (const batch of chunk(contactGroupRows, BATCH_SIZE)) {
          await tx.insert(contactGroups).values(batch);
        }
      }
    });

    console.log(
      `Seeded ${contactRows.length} contacts, ${noteRows.length} notes ` +
        `and ${checkInRows.length} check-ins` +
        (seedGroups
          ? `, ${groupRows.length} groups with ${contactGroupRows.length} memberships`
          : `; groups were left as they are (the database already has some)`),
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
