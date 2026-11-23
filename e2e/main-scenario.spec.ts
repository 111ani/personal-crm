// The main scenario from specs/01-продуктовая-идея.md, in a real browser
// against the real app and database

import { expect, test, type Page } from "@playwright/test";

import { insertContacts, resetDatabase } from "./database";

const knownPeople = ["Анна Смирнова", "Борис Петров", "Вера Иванова"];

const newContact = {
  name: "Дмитрий Орлов",
  about: "Инструктор по скалолазанию",
  howWeMet: "Познакомились в походе на Эльбрус",
  phone: "+7 900 555-12-34",
  email: "dmitry.orlov@example.com",
};

const note = "Договорились в пятницу созвониться про поход в горы";

function contactList(page: Page) {
  return page.getByRole("region", { name: "Контакты", exact: true });
}

// Everything entered in the scenario is in the card
async function expectSavedCard(page: Page) {
  await expect(
    page.getByRole("heading", { level: 1, name: newContact.name }),
  ).toBeVisible();
  await expect(page.getByText(newContact.about)).toBeVisible();
  await expect(page.getByText(newContact.howWeMet)).toBeVisible();
  await expect(page.getByRole("link", { name: newContact.phone })).toBeVisible();
  await expect(page.getByRole("link", { name: newContact.email })).toBeVisible();
  await expect(page.getByText("о чём договорились — 1 запись")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: note })).toBeVisible();
}

test.beforeEach(async () => {
  await resetDatabase();
  await insertContacts(knownPeople);
});

test("Главный сценарий: список → новый контакт → поиск по имени → заметка; в другом браузере те же данные", async ({
  page,
  browser,
  baseURL,
}) => {
  await test.step("Открыл — видно список всех контактов", async () => {
    await page.goto("/");
    const list = contactList(page);
    await expect(list.getByText("Всего 3 контакта")).toBeVisible();
    await expect(list.getByRole("link")).toHaveCount(knownPeople.length);
    for (const name of knownPeople) {
      await expect(list.getByRole("link", { name })).toBeVisible();
    }
  });

  await test.step("Добавил контакт — появился в списке", async () => {
    await page.getByRole("button", { name: "Добавить контакт" }).click();
    const dialog = page.getByRole("dialog", { name: "Новый контакт" });
    await dialog.getByLabel("Имя").fill(newContact.name);
    await dialog.getByLabel("Кто это").fill(newContact.about);
    await dialog.getByLabel("Откуда знакомы").fill(newContact.howWeMet);
    await dialog.getByLabel("Телефон").fill(newContact.phone);
    await dialog.getByLabel("Почта").fill(newContact.email);
    await dialog.getByRole("button", { name: "Добавить", exact: true }).click();

    await expect(dialog).toBeHidden();
    await expect(
      page.getByText(`Контакт «${newContact.name}» добавлен`),
    ).toBeVisible();
    const list = contactList(page);
    await expect(list.getByText("Всего 4 контакта")).toBeVisible();
    await expect(list.getByRole("link", { name: newContact.name })).toBeVisible();
  });

  await test.step("Нашёл контакт по имени — открыл карточку, дописал заметку", async () => {
    await page.getByRole("searchbox", { name: "Поиск по имени" }).fill("Орлов");
    const list = contactList(page);
    await expect(list.getByText("Найдено: 1 контакт из 4")).toBeVisible();
    await expect(list.getByRole("link")).toHaveCount(1);
    await list.getByRole("link", { name: newContact.name }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: newContact.name }),
    ).toBeVisible();
    await page.getByLabel("Новая заметка").fill(note);
    await page.getByRole("button", { name: "Добавить заметку" }).click();
    await expect(page.getByText("Заметка добавлена")).toBeVisible();
  });

  await test.step("Изменения сохранились в карточке контакта", async () => {
    // After a reload the card comes from the database, not from the page
    await page.reload();
    await expectSavedCard(page);
  });

  await test.step("Открыл тот же адрес в другом браузере — те же контакты", async () => {
    // A separate browser profile: no shared cookies, storage or cache
    const otherBrowser = await browser.newContext({ baseURL });
    try {
      const otherPage = await otherBrowser.newPage();
      await otherPage.goto("/");
      const list = contactList(otherPage);
      await expect(list.getByText("Всего 4 контакта")).toBeVisible();
      for (const name of [...knownPeople, newContact.name]) {
        await expect(list.getByRole("link", { name })).toBeVisible();
      }

      await otherPage.goto(page.url());
      await expectSavedCard(otherPage);
    } finally {
      await otherBrowser.close();
    }
  });
});
