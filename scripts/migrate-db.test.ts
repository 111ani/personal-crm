import { expect, test } from "vitest";

import { getTestDatabaseUrl } from "../test/database-url";
import {
  migrateBeforeAuth,
  withMigrationDatabase,
} from "../test/migration-fixture";
import { migrateDatabase } from "./migrate-db";

test("Migrate a clean database without an owner setting", async () => {
  await withMigrationDatabase(getTestDatabaseUrl(), async (pool) => {
    await migrateDatabase(pool, undefined);
    expect((await pool.query("select email from auth_user")).rows).toEqual([]);
  });
});

test("The migration assigns legacy records to the owner and preserves their contents and IDs", async () => {
  await withMigrationDatabase(getTestDatabaseUrl(), async (pool) => {
    await migrateBeforeAuth(pool);
    const {
      rows: [contact],
    } = await pool.query(
      "insert into contacts (name, about) values ('Anna', 'Known for years') returning *",
    );
    const {
      rows: [group],
    } = await pool.query(
      "insert into groups (name) values ('Friends') returning *",
    );
    await pool.query(
      "insert into notes (contact_id, body) values ($1, 'Called')",
      [contact.id],
    );
    await pool.query("insert into contact_check_ins (contact_id) values ($1)", [
      contact.id,
    ]);
    await pool.query(
      "insert into contact_groups (contact_id, group_id) values ($1, $2)",
      [contact.id, group.id],
    );

    await expect(migrateDatabase(pool, undefined)).rejects.toThrow(
      /CRM_OWNER_EMAIL/,
    );
    await expect(migrateDatabase(pool, "invalid")).rejects.toThrow(
      /CRM_OWNER_EMAIL/,
    );
    expect((await pool.query("select * from contacts")).rows).toEqual([
      contact,
    ]);
    expect(
      (await pool.query("select to_regclass('public.auth_user') as table_name"))
        .rows,
    ).toEqual([{ table_name: null }]);

    const preserved = ["notes", "contact_check_ins", "contact_groups"] as const;
    const before = await Promise.all(
      preserved.map(
        async (table) => (await pool.query(`select * from ${table}`)).rows,
      ),
    );
    await migrateDatabase(pool, " OWNER@EXAMPLE.COM ");
    await migrateDatabase(pool, "owner@example.com");
    const {
      rows: [owner],
    } = await pool.query("select id, email from auth_user");
    expect(owner.email).toBe("owner@example.com");
    expect((await pool.query("select * from contacts")).rows).toEqual([
      { ...contact, owner_id: owner.id },
    ]);
    expect((await pool.query("select * from groups")).rows).toEqual([
      { ...group, owner_id: owner.id },
    ]);
    const after = await Promise.all(
      preserved.map(
        async (table) => (await pool.query(`select * from ${table}`)).rows,
      ),
    );
    expect(after).toEqual(before);
  });
});
