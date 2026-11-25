import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { DatabaseError, type Pool } from "pg";

import { parseOwnerEmail } from "../src/lib/auth/email.ts";

export async function migrateDatabase(
  pool: Pool,
  owner: string | undefined,
  migrationsFolder = "drizzle",
) {
  const client = await pool.connect();
  try {
    const ownerEmail = parseOwnerEmail(owner);
    await client.query("select set_config('crm.owner_email', $1, false)", [
      ownerEmail ?? "",
    ]);
    await migrate(drizzle(client), { migrationsFolder });
  } catch (error) {
    if (
      error instanceof Error &&
      error.cause instanceof DatabaseError &&
      error.cause.code === "CR001"
    ) {
      throw error.cause;
    }
    throw error;
  } finally {
    // Close the connection to keep the migration setting out of the pool.
    client.release(true);
  }
}
