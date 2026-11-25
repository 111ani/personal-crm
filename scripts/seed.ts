// Seeds demo contacts for CRM_OWNER_EMAIL. With --reset, replaces that account's records.

import { existsSync } from "node:fs";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { seedDatabase } from "./seed-db.ts";

async function main() {
  if (existsSync(".env")) {
    process.loadEnvFile(".env");
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env");
  }

  const pool = new Pool({ connectionString });
  try {
    const result = await seedDatabase(
      drizzle(pool),
      process.env.CRM_OWNER_EMAIL,
      process.argv.includes("--reset"),
    );
    if (!result) {
      console.log(
        "The owner already has contacts. Use pnpm db:seed --reset to replace that account's records.",
      );
      return;
    }
    console.log(
      `Seeded ${result.contacts} contacts, ${result.notes} notes and ${result.checkIns} check-ins` +
        (result.groups
          ? `, ${result.groups} groups with ${result.memberships} memberships`
          : "; the owner's existing groups were kept"),
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
