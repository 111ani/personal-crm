import { existsSync } from "node:fs";

/**
 * The address of the test database: the main one from .env with `_test`
 * added to the database name. Tests never touch the main database.
 */
export function getTestDatabaseUrl(): string {
  if (existsSync(".env")) {
    process.loadEnvFile(".env");
  }
  const mainUrl = process.env.DATABASE_URL;
  if (!mainUrl) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env");
  }

  const url = new URL(mainUrl);
  if (!url.pathname.endsWith("_test")) {
    url.pathname = `${url.pathname}_test`;
  }
  return url.toString();
}

export function getMainDatabaseUrl(): string {
  const url = new URL(getTestDatabaseUrl());
  url.pathname = url.pathname.replace(/_test$/, "");
  return url.toString();
}
