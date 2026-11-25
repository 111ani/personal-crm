import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

import {
  ageOldestLink,
  insertContactWithGroups,
  insertContacts,
  resetDatabase,
  seedDemoData,
  setSessionAge,
} from "./database";
import { findMessages } from "./mailpit";
import { fixtureEmail, requestLink, signIn } from "./sign-in";

test.beforeEach(async () => {
  await resetDatabase();
});

async function createContact(page: Page, name: string) {
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  const dialog = page.getByRole("dialog", { name: "Новый контакт" });
  await dialog.getByLabel("Имя").fill(name);
  await dialog.getByRole("button", { name: "Добавить", exact: true }).click();
  const link = page.getByRole("link", { name });
  await expect(link).toBeVisible();
  return (await link.getAttribute("href"))!;
}

test("Private pages require sign-in and the health check remains public", async ({
  page,
  request,
}) => {
  const [{ id }] = await insertContacts(fixtureEmail(), ["Приватный контакт"]);
  for (const path of ["/", "/groups", `/contacts/${id}`]) {
    await page.goto(path);
    await expect(page.getByLabel("Почта")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Получить ссылку" }),
    ).toBeVisible();
    await expect(page.getByText("Приватный контакт")).toHaveCount(0);
  }
  expect((await request.get("/health")).ok()).toBe(true);
});

test("The sign-in form reports an invalid address below the field", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Почта").fill("invalid");
  await page.getByRole("button", { name: "Получить ссылку" }).click();
  await expect(page.getByLabel("Почта")).toHaveAccessibleDescription(
    "Проверь адрес почты",
  );
  expect(await findMessages("invalid")).toEqual([]);
});

test("Mailpit receives the sign-in email for an arbitrary valid address", async ({
  page,
  baseURL,
}) => {
  const email = fixtureEmail();
  const { link, message } = await requestLink(page, email);
  expect(message.From).toEqual({
    Address: "noreply@mail.crm.example.test",
    Name: "Личная CRM",
  });
  expect(message.Subject).toBe("Вход в Личную CRM");
  expect(message.HTML).toContain(">Войти</a>");
  expect(message.HTML).toContain("действует 15 минут");
  expect(message.HTML).toContain(
    "Если вы не запрашивали вход - просто проигнорируйте письмо",
  );
  expect(new URL(link).origin).toBe(baseURL);
  await page.goto(link);
  await expect(page.getByText("Добавь первый контакт")).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
});

test("A used link displays the expired page with a way back to sign-in", async ({
  page,
  browser,
  baseURL,
}) => {
  const { link } = await requestLink(page, fixtureEmail());
  await page.goto(link);
  await expect(
    page.getByRole("heading", { name: "Контакты", exact: true }),
  ).toBeVisible();
  const other = await browser.newContext({ baseURL });
  try {
    const second = await other.newPage();
    await second.goto(link);
    await expect(
      second.getByRole("heading", { name: "Ссылка устарела, запроси новую" }),
    ).toBeVisible();
    await second.getByRole("link", { name: "На страницу входа" }).click();
    await expect(second.getByLabel("Почта")).toBeVisible();
  } finally {
    await other.close();
  }
});

test("The link expires after fifteen minutes", async ({ page }) => {
  const email = fixtureEmail();
  const { link } = await requestLink(page, email);
  await ageOldestLink(email, 15);
  await page.goto(link);
  await expect(
    page.getByRole("heading", { name: "Ссылка устарела, запроси новую" }),
  ).toBeVisible();
});

test("The address limit applies across browsers and leaves the latest link active", async ({
  page,
  browser,
  baseURL,
}) => {
  const email = fixtureEmail();
  const other = await browser.newContext({ baseURL });
  try {
    const second = await other.newPage();
    const first = await requestLink(page, email);
    await requestLink(second, email.toUpperCase());
    const latest = await requestLink(page, email);
    await second.goto("/login");
    await second.getByLabel("Почта").fill(email.toUpperCase());
    await second.getByRole("button", { name: "Получить ссылку" }).click();
    await expect(
      second.getByText("Слишком часто, попробуй через несколько минут", {
        exact: true,
      }),
    ).toBeVisible();
    expect(await findMessages(email)).toHaveLength(3);
    await requestLink(second, fixtureEmail());
    await second.goto(first.link);
    await expect(
      second.getByRole("heading", { name: "Ссылка устарела, запроси новую" }),
    ).toBeVisible();
    await page.goto(latest.link);
    await expect(
      page.getByRole("heading", { name: "Контакты", exact: true }),
    ).toBeVisible();
    await ageOldestLink(email, 10);
    await requestLink(second, email);
  } finally {
    await other.close();
  }
});

test("A browser visit updates the session cookie and an expired session requires sign-in", async ({
  page,
  context,
}) => {
  const email = fixtureEmail();
  await signIn(page, email);
  const cookie = (await context.cookies()).find(({ name }) =>
    name.endsWith("session_token"),
  );
  if (!cookie) throw new Error("Missing sign-in cookie");
  await context.addCookies([
    { ...cookie, expires: Math.floor(Date.now() / 1000) + 86_400 },
  ]);
  await setSessionAge(email, 29);
  await page.reload();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  const renewed = (await context.cookies()).find(
    ({ name }) => name === cookie.name,
  );
  expect(renewed?.expires).toBeGreaterThan(Date.now() / 1000 + 29 * 86_400);
  await setSessionAge(email, 31);
  await page.reload();
  await expect(page.getByLabel("Почта")).toBeVisible();
});

test("Only the configured owner sees the demo contacts, notes and groups", async ({
  page,
  browser,
  baseURL,
}) => {
  const email = fixtureEmail();
  const sample = await seedDemoData(email.toUpperCase());
  await signIn(page, email);
  await expect(
    page.getByRole("link", { name: sample.group, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Поиск по имени" })
    .fill(sample.name);
  await expect(page.getByText("Найдено: 1 контакт из 1 000")).toBeVisible();
  await page.getByRole("link", { name: sample.name }).click();
  await expect(
    page.getByText(sample.note, { exact: true }).first(),
  ).toBeVisible();
  const other = await browser.newContext({ baseURL });
  try {
    const second = await other.newPage();
    await signIn(second, fixtureEmail());
    await expect(second.getByText("Добавь первый контакт")).toBeVisible();
    await second.goto(`/contacts/${sample.id}`);
    await expect(
      second.getByRole("heading", { name: "Контакт не найден" }),
    ).toBeVisible();
  } finally {
    await other.close();
  }
});

test("Signing out from one browser leaves the other browser signed in", async ({
  page,
  browser,
  baseURL,
}) => {
  const email = fixtureEmail();
  await signIn(page, email);
  const other = await browser.newContext({ baseURL });
  try {
    const second = await other.newPage();
    await signIn(second, email.toUpperCase());
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    await expect(second.getByText(email, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Выйти" }).click();
    await expect(page.getByLabel("Почта")).toBeVisible();
    await page.goto("/groups");
    await expect(page.getByLabel("Почта")).toBeVisible();
    await second.reload();
    await expect(second.getByText(email, { exact: true })).toBeVisible();
  } finally {
    await other.close();
  }
});

test("Each account has its own list, search, count and cards", async ({
  page,
  browser,
  baseURL,
}) => {
  await signIn(page, fixtureEmail());
  await expect(page.getByText("Добавь первый контакт")).toBeVisible();
  const firstName = "Анна Вересова";
  const firstCard = await createContact(page, firstName);
  const other = await browser.newContext({ baseURL });
  try {
    const second = await other.newPage();
    await signIn(second, fixtureEmail());
    await expect(second.getByText("Добавь первый контакт")).toBeVisible();
    const secondName = "Борис Волков";
    const secondCard = await createContact(second, secondName);
    for (const [tab, own, foreign, foreignCard] of [
      [page, firstName, secondName, secondCard],
      [second, secondName, firstName, firstCard],
    ] as const) {
      await expect(tab.getByRole("link", { name: own })).toBeVisible();
      await expect(tab.getByRole("link", { name: foreign })).toHaveCount(0);
      await expect(
        tab.getByText("Всего 1 контакт", { exact: true }),
      ).toBeVisible();
      await tab.getByRole("searchbox", { name: "Поиск по имени" }).fill(own);
      await expect(tab.getByText("Найдено: 1 контакт из 1")).toBeVisible();
      await tab
        .getByRole("searchbox", { name: "Поиск по имени" })
        .fill(foreign);
      await expect(tab.getByText("Найдено: 0 контактов из 1")).toBeVisible();
      await tab.goto(foreignCard);
      await expect(
        tab.getByRole("heading", { name: "Контакт не найден" }),
      ).toBeVisible();
    }
    await second.goto(`/contacts/${randomUUID()}`);
    await expect(
      second.getByRole("heading", { name: "Контакт не найден" }),
    ).toBeVisible();
  } finally {
    await other.close();
  }
});

test("The groups page, contact picker and filter only use the signed-in account's groups", async ({
  page,
}) => {
  const owner = fixtureEmail();
  const { contactId, groupId } = await insertContactWithGroups(
    owner,
    "Борис Волков",
    "Коллеги",
    "Теннис",
  );
  const { groupId: foreignGroup } = await insertContactWithGroups(
    fixtureEmail(),
    "Анна Вересова",
    "Соседи",
    "Семья",
  );
  await signIn(page, owner);

  await page.goto("/groups");
  await expect(page.getByText("Коллеги — 1 контакт")).toBeVisible();
  await expect(page.getByText("Соседи", { exact: false })).toHaveCount(0);

  await page.goto(`/contacts/${contactId}`);
  await expect(
    page.getByRole("button", { name: "Коллеги", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Соседи", exact: true }),
  ).toHaveCount(0);

  await page.goto(`/?group=${groupId}`);
  await expect(
    page.getByRole("link", { name: "Коллеги", exact: true }),
  ).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("link", { name: "Борис Волков" })).toBeVisible();
  for (const group of [foreignGroup, randomUUID()]) {
    await page.goto(`/?group=${group}`);
    await expect(
      page.getByRole("link", { name: "Все", exact: true }),
    ).toHaveAttribute("aria-current", "true");
    await expect(
      page.getByText("Всего 1 контакт", { exact: true }),
    ).toBeVisible();
  }
});
