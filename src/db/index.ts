import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env");
  }
  return drizzle(new Pool({ connectionString, max: 10 }), { schema });
}

// One pool per process, also across hot reloads in development
const globalForDb = globalThis as unknown as {
  db?: ReturnType<typeof createDb>;
};

/**
 * The database, created on the first call rather than on import: the build
 * loads this module but never queries, so it runs without DATABASE_URL.
 */
export function getDb() {
  globalForDb.db ??= createDb();
  return globalForDb.db;
}
