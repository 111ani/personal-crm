// Fills the database with test contacts.
//   pnpm db:seed          - only if the database has no contacts yet
//   pnpm db:seed --reset  - DELETES all contacts and notes, then seeds

import { existsSync } from "node:fs";

import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { contacts, notes } from "../src/db/schema";
import { generateSeedData } from "./seed-data";

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

    const { contactRows, noteRows } = generateSeedData(
      CONTACT_COUNT,
      new Date(),
    );

    await db.transaction(async (tx) => {
      if (reset) {
        await tx.delete(notes);
        await tx.delete(contacts);
      }
      for (const batch of chunk(contactRows, BATCH_SIZE)) {
        await tx.insert(contacts).values(batch);
      }
      for (const batch of chunk(noteRows, BATCH_SIZE)) {
        await tx.insert(notes).values(batch);
      }
    });

    console.log(
      `Seeded ${contactRows.length} contacts and ${noteRows.length} notes`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
