import { existsSync } from "node:fs";

// Test databases are named after the main one: crm -> crm_test (Vitest),
// crm_e2e (Playwright). Separate, so both test runs never clash
const TEST_SUFFIXES = ["_test", "_e2e"] as const;

export type TestSuffix = (typeof TEST_SUFFIXES)[number];

function readDatabaseUrl(): URL {
  if (!process.env.DATABASE_URL && existsSync(".env")) {
    process.loadEnvFile(".env");
  }
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env");
  }
  return new URL(value);
}

/** The main database from .env, even if DATABASE_URL points to a test one */
export function getMainDatabaseUrl(): string {
  const url = readDatabaseUrl();
  for (const suffix of TEST_SUFFIXES) {
    if (url.pathname.endsWith(suffix)) {
      url.pathname = url.pathname.slice(0, -suffix.length);
    }
  }
  return url.toString();
}

function getDatabaseUrlWithSuffix(suffix: TestSuffix): string {
  const url = new URL(getMainDatabaseUrl());
  url.pathname = `${url.pathname}${suffix}`;
  return url.toString();
}

/**
 * The address of the Vitest database: the main one from .env with `_test`
 * added to the database name. Tests never touch the main database.
 */
export function getTestDatabaseUrl(): string {
  return getDatabaseUrlWithSuffix("_test");
}

/** The address of the e2e (Playwright) database: the main name + `_e2e` */
export function getE2eDatabaseUrl(): string {
  return getDatabaseUrlWithSuffix("_e2e");
}
