import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Pool } from "pg";

import { migrateDatabase } from "../scripts/migrate-db";

export async function withMigrationDatabase(
  baseUrl: string,
  work: (pool: Pool, url: string) => Promise<void>,
) {
  const connection = new URL(baseUrl);
  const database = `crm_migration_${randomUUID().replaceAll("-", "")}_test`;
  const admin = new Pool({ connectionString: connection.toString() });
  try {
    await admin.query(`create database ${database}`);
    connection.pathname = database;
    const url = connection.toString();
    const pool = new Pool({ connectionString: url });
    try {
      await work(pool, url);
    } finally {
      await pool.end();
      await admin.query(`drop database ${database}`);
    }
  } finally {
    await admin.end();
  }
}

export async function migrateBeforeAuth(pool: Pool) {
  const folder = await mkdtemp(join(tmpdir(), "crm-migrate-test-"));
  try {
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    );
    const entries = journal.entries.slice(0, 4) as Array<{ tag: string }>;
    await mkdir(join(folder, "meta"));
    await writeFile(
      join(folder, "meta", "_journal.json"),
      JSON.stringify({ ...journal, entries }),
    );
    for (const { tag } of entries) {
      await writeFile(
        join(folder, `${tag}.sql`),
        await readFile(`drizzle/${tag}.sql`),
      );
    }
    await migrateDatabase(pool, undefined, folder);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
