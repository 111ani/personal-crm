// Shared by Vitest (test/global-setup.ts, test/setup.ts) and Playwright
// (e2e/global-setup.ts, e2e/database.ts): each has its own test database.

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { getMainDatabaseUrl, type TestSuffix } from "./database-url";

const DATABASE_DOWN = "Запустите базу: pnpm db:up";

async function createDatabaseIfMissing(name: string) {
  // The main database always exists, so connect to it to create the test one
  const pool = new Pool({ connectionString: getMainDatabaseUrl() });
  try {
    const { rows } = await pool.query(
      "select 1 from pg_database where datname = $1",
      [name],
    );
    if (rows.length === 0) {
      // A database name cannot be a query parameter; it is quoted instead
      await pool.query(`create database "${name.replaceAll('"', '""')}"`);
    }
  } finally {
    await pool.end();
  }
}

/** Makes sure the test database exists and has all migrations applied */
export async function prepareTestDatabase(url: string) {
  const name = decodeURIComponent(new URL(url).pathname.slice(1));

  try {
    await createDatabaseIfMissing(name);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (
      code === "ECONNREFUSED" ||
      code === "ETIMEDOUT" ||
      code === "ENOTFOUND"
    ) {
      throw new Error(DATABASE_DOWN, { cause: error });
    }
    throw error;
  }

  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  } finally {
    await pool.end();
  }
}

/**
 * Empties every table, keeping the tables themselves. The guard: refuses to
 * touch a database whose name does not end in `suffix`, so never the main one
 */
export async function emptyTestDatabase(pool: Pool, suffix: TestSuffix) {
  const { rows: current } = await pool.query<{ name: string }>(
    "select current_database() as name",
  );
  const name = current[0].name;
  if (!name.endsWith(suffix)) {
    throw new Error(
      `Refusing to clean database "${name}": tests run only on a database ending in ${suffix}`,
    );
  }

  const { rows: tables } = await pool.query<{ tablename: string }>(
    "select tablename from pg_tables where schemaname = 'public'",
  );
  if (tables.length > 0) {
    const list = tables.map((table) => `"${table.tablename}"`).join(", ");
    await pool.query(`truncate table ${list} restart identity cascade`);
  }
}
