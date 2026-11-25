// Applies pending migrations from the drizzle folder and exits.
// On the server it runs in a one-off container before the new image starts
// (see deploy/deploy.sh). Locally use pnpm db:migrate instead.

import { existsSync } from "node:fs";

import { Pool } from "pg";

import { migrateDatabase } from "./migrate-db.ts";

async function countApplied(pool: Pool): Promise<number> {
  const table = await pool.query<{ exists: boolean }>(
    "select to_regclass('drizzle.__drizzle_migrations') is not null as exists",
  );
  if (!table.rows[0]?.exists) {
    return 0;
  }
  const { rows } = await pool.query<{ count: number }>(
    "select count(*)::int as count from drizzle.__drizzle_migrations",
  );
  return rows[0]?.count ?? 0;
}

async function main() {
  if (!process.env.DATABASE_URL && existsSync(".env")) {
    process.loadEnvFile(".env");
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env");
  }

  const pool = new Pool({ connectionString });
  try {
    const before = await countApplied(pool);
    await migrateDatabase(pool, process.env.CRM_OWNER_EMAIL);
    const after = await countApplied(pool);
    console.log(
      `Migrations: ${after - before} applied now, ${after} applied in total`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
