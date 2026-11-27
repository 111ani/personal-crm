import { expect, test, type Page } from "@playwright/test";

import {
  insertContactWithGroups,
  resetDatabase,
  setBirthdayRelativeToToday,
} from "./database";
import { fixtureEmail, signIn } from "./sign-in";

const friend = "Анна Смирнова";
const family = "Семья";

function birthdayBlock(page: Page) {
  return page.getByRole("region", { name: "Скоро день рождения" });
}

async function openWithBirthday(page: Page, days = 0) {
  const email = fixtureEmail();
  const { contactId } = await insertContactWithGroups(
    email,
    friend,
    "Друзья",
    family,
  );
  await setBirthdayRelativeToToday(contactId, days);
  await signIn(page, email);
  return contactId;
}

test.beforeEach(async () => {
  await resetDatabase();
});

test("Displays birthdays below the title and above search", async ({
  page,
}) => {
  await openWithBirthday(page);
  const title = page.getByRole("heading", { name: "Контакты", exact: true });
  const block = birthdayBlock(page);
  const search = page.getByRole("searchbox", { name: "Поиск по имени" });
  await expect(block.getByText(friend, { exact: true })).toBeVisible();
  await expect(search).toBeVisible();

  const [titleBox, blockBox, searchBox] = await Promise.all([
    title.boundingBox(),
    block.boundingBox(),
    search.boundingBox(),
  ]);
  if (!titleBox || !blockBox || !searchBox)
    throw new Error("Home elements are not visible");
  expect(titleBox.y + titleBox.height).toBeLessThanOrEqual(blockBox.y);
  expect(blockBox.y + blockBox.height).toBeLessThanOrEqual(searchBox.y);
});

test("Hides the block when every birthday is outside the window", async ({
  page,
}) => {
  await openWithBirthday(page, 7);
  await expect(
    page
      .getByRole("region", { name: "Контакты" })
      .getByText(friend, { exact: true }),
  ).toBeVisible();
  await expect(birthdayBlock(page)).toHaveCount(0);
});

test("Hides birthdays while searching and restores them when search is cleared", async ({
  page,
}) => {
  await openWithBirthday(page);
  const search = page.getByRole("searchbox", { name: "Поиск по имени" });
  await expect(birthdayBlock(page)).toBeVisible();

  await search.fill("Анна");
  await expect(page).toHaveURL(/[?&]q=/);
  await expect(birthdayBlock(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Очистить поиск" }).click();
  await expect(birthdayBlock(page)).toBeVisible();
});

test("Keeps birthdays from outside the selected group", async ({ page }) => {
  await openWithBirthday(page);
  const group = page.getByRole("link", { name: family, exact: true });
  await group.click();

  await expect(group).toHaveAttribute("aria-current", "true");
  await expect(
    page.getByText("В группе «Семья» пока никого нет"),
  ).toBeVisible();
  await expect(
    birthdayBlock(page).getByText(friend, { exact: true }),
  ).toBeVisible();
});

test("Removes a birthday from the home page after clearing it in the card", async ({
  page,
}) => {
  const id = await openWithBirthday(page);
  await expect(birthdayBlock(page)).toBeVisible();
  await page.goto(`/contacts/${id}`);
  const day = page.getByLabel("День", { exact: true });
  const month = page.getByLabel("Месяц", { exact: true });
  await day.fill("");
  await month.fill("");
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(page.getByText("Изменения сохранены")).toBeVisible();
  await page.reload();
  await expect(day).toHaveValue("");
  await expect(month).toHaveValue("");

  await page.getByRole("link", { name: "Все контакты" }).click();
  await expect(
    page
      .getByRole("region", { name: "Контакты" })
      .getByText(friend, { exact: true }),
  ).toBeVisible();
  await expect(birthdayBlock(page)).toHaveCount(0);
});

test("Saves day and month when the year is left blank", async ({ page }) => {
  const id = await openWithBirthday(page);
  await page.goto(`/contacts/${id}`);
  const day = page.getByLabel("День", { exact: true });
  const month = page.getByLabel("Месяц", { exact: true });
  const year = page.getByLabel("Год", { exact: true });
  await day.fill("16");
  await month.fill("5");
  await expect(year).toHaveValue("");
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(page.getByText("Изменения сохранены")).toBeVisible();
  await page.reload();
  await expect(day).toHaveValue("16");
  await expect(month).toHaveValue("5");
  await expect(year).toHaveValue("");
});

test("Clears only the year in the contact card", async ({ page }) => {
  const id = await openWithBirthday(page);
  await page.goto(`/contacts/${id}`);
  const day = page.getByLabel("День", { exact: true });
  const month = page.getByLabel("Месяц", { exact: true });
  const year = page.getByLabel("Год", { exact: true });
  const save = page.getByRole("button", { name: "Сохранить изменения" });
  await day.fill("16");
  await month.fill("5");
  await year.fill("1990");
  await save.click();
  await expect(page.getByText("Изменения сохранены")).toBeVisible();
  await page.reload();
  await expect(year).toHaveValue("1990");

  await year.fill("");
  await save.click();
  await expect(page.getByText("Изменения сохранены")).toBeVisible();
  await page.reload();
  await expect(day).toHaveValue("16");
  await expect(month).toHaveValue("5");
  await expect(year).toHaveValue("");
});
