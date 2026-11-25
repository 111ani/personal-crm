import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import { migrateDatabase } from "../scripts/migrate-db";
import { getE2eDatabaseUrl } from "../test/database-url";
import {
  migrateBeforeAuth,
  withMigrationDatabase,
} from "../test/migration-fixture";
import { authEnvironment } from "./auth-environment";
import { fixtureEmail, signIn } from "./sign-in";

test("Legacy records survive the migration and are visible to the owner only", async ({
  browser,
}) => {
  const ownerEmail = fixtureEmail();
  const contactName = "Анна Смирнова";
  const note = "Заметка до переноса";
  const groupName = "Друзья";
  await withMigrationDatabase(
    getE2eDatabaseUrl(),
    async (pool, databaseUrl) => {
      await migrateBeforeAuth(pool);
      const {
        rows: [contact],
      } = await pool.query(
        "insert into contacts (name, contact_frequency, contact_frequency_set_at) values ($1, 'week', now() - interval '7 days') returning id",
        [contactName],
      );
      const {
        rows: [group],
      } = await pool.query(
        "insert into groups (name) values ($1) returning id",
        [groupName],
      );
      await pool.query(
        "insert into contact_groups (contact_id, group_id) values ($1, $2)",
        [contact.id, group.id],
      );
      await pool.query("insert into notes (contact_id, body) values ($1, $2)", [
        contact.id,
        note,
      ]);
      await pool.query(
        "insert into contact_check_ins (contact_id) values ($1)",
        [contact.id],
      );
      await migrateDatabase(pool, ownerEmail.toUpperCase());

      const port = "3101";
      const baseURL = `http://127.0.0.1:${port}`;
      const server = spawn(
        process.execPath,
        [
          resolve("node_modules/next/dist/bin/next"),
          "start",
          "--hostname",
          "127.0.0.1",
          "--port",
          port,
        ],
        {
          env: { ...process.env, ...authEnvironment(baseURL, databaseUrl) },
          stdio: ["ignore", "ignore", "inherit"],
        },
      );
      const result = new Promise<Error | undefined>((done) => {
        server.once("error", done);
        server.once("exit", () => done(undefined));
      });
      try {
        await expect
          .poll(async () =>
            fetch(`${baseURL}/health`).then(
              (r) => r.ok,
              () => false,
            ),
          )
          .toBe(true);
        const owner = await browser.newContext({ baseURL });
        const other = await browser.newContext({ baseURL });
        try {
          const ownerPage = await owner.newPage();
          await signIn(ownerPage, ownerEmail);
          await expect(
            ownerPage.getByRole("link", { name: groupName, exact: true }),
          ).toBeVisible();
          await ownerPage.getByRole("link", { name: contactName }).click();
          await expect(
            ownerPage.getByText(note, { exact: true }),
          ).toBeVisible();
          await expect(
            ownerPage.getByRole("button", { name: groupName, exact: true }),
          ).toHaveAttribute("aria-pressed", "true");
          await expect(
            ownerPage.getByRole("checkbox", { name: "Связались сегодня" }),
          ).toBeChecked();

          const otherPage = await other.newPage();
          await signIn(otherPage, fixtureEmail());
          await expect(
            otherPage.getByText("Добавь первый контакт"),
          ).toBeVisible();
          await otherPage.goto(`/contacts/${contact.id}`);
          await expect(
            otherPage.getByRole("heading", { name: "Контакт не найден" }),
          ).toBeVisible();
        } finally {
          await Promise.all([owner.close(), other.close()]);
        }
      } finally {
        server.kill();
        const error = await result;
        if (error) throw error;
      }
    },
  );
});
