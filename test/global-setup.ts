// Runs once before all tests: makes sure the test database exists and has
// all migrations applied.

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { getMainDatabaseUrl, getTestDatabaseUrl } from "./database-url";

const DATABASE_DOWN = "Запустите базу: pnpm db:up";

async function createTestDatabaseIfMissing(testName: string) {
  // The main database always exists, so connect to it to create the test one
  const pool = new Pool({ connectionString: getMainDatabaseUrl() });
  try {
    const { rows } = await pool.query(
      "select 1 from pg_database where datname = $1",
      [testName],
    );
    if (rows.length === 0) {
      // A database name cannot be a query parameter; it is quoted instead
      await pool.query(`create database "${testName.replaceAll('"', '""')}"`);
    }
  } finally {
    await pool.end();
  }
}

export default async function setup() {
  const testUrl = getTestDatabaseUrl();
  const testName = decodeURIComponent(new URL(testUrl).pathname.slice(1));

  try {
    await createTestDatabaseIfMissing(testName);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "ENOTFOUND") {
      throw new Error(DATABASE_DOWN, { cause: error });
    }
    throw error;
  }

  const pool = new Pool({ connectionString: testUrl });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  } finally {
    await pool.end();
  }
}
