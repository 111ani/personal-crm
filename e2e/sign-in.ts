import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

import { findMessages, waitForMessage } from "./mailpit";

export function fixtureEmail() {
  return `crm-${randomUUID()}@example.test`;
}

export async function requestLink(page: Page, email: string) {
  const normalized = email.trim().toLowerCase();
  const previousIds = (await findMessages(normalized)).map(({ ID }) => ID);
  await page.goto("/login");
  await page.getByLabel("Почта").fill(email);
  await page.getByRole("button", { name: "Получить ссылку" }).click();
  await expect(page.getByRole("status")).toHaveText(
    `Ссылка для входа отправлена на ${normalized}`,
  );
  const message = await waitForMessage(normalized, previousIds);
  const link = /^Войти: (https?:\/\/\S+)/m.exec(message.Text)?.[1];
  if (!link) throw new Error("The sign-in message has no link");
  return { link, message };
}

export async function signIn(page: Page, email: string) {
  const { link } = await requestLink(page, email);
  await page.goto(link);
  await expect(
    page.getByRole("heading", { name: "Контакты", exact: true }),
  ).toBeVisible();
}
