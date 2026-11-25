import { expect, test } from "@playwright/test";

import { insertContactWithGroups, resetDatabase } from "./database";
import { fixtureEmail, signIn } from "./sign-in";

const contactName = "Анна Смирнова";
const assignedGroup = "Семья";
const unassignedGroup = "Теннис";

test.beforeEach(async ({ page }) => {
  await resetDatabase();
  const email = fixtureEmail();
  await insertContactWithGroups(
    email,
    contactName,
    assignedGroup,
    unassignedGroup,
  );
  await signIn(page, email);
});

test("Без сохранения группы контакта не меняются", async ({ page }) => {
  await page.goto("/");
  const contactLink = page.getByRole("link", { name: contactName });
  await contactLink.click();

  const assigned = page.getByRole("button", {
    name: assignedGroup,
    exact: true,
  });
  const unassigned = page.getByRole("button", {
    name: unassignedGroup,
    exact: true,
  });
  await expect(assigned).toHaveAttribute("aria-pressed", "true");
  await expect(unassigned).toHaveAttribute("aria-pressed", "false");

  await assigned.click();
  await unassigned.click();
  await expect(assigned).toHaveAttribute("aria-pressed", "false");
  await expect(unassigned).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("link", { name: "Все контакты" }).click();
  await contactLink.click();
  await expect(
    page.getByRole("heading", { level: 1, name: contactName }),
  ).toBeVisible();
  await page.reload();
  await expect(assigned).toHaveAttribute("aria-pressed", "true");
  await expect(unassigned).toHaveAttribute("aria-pressed", "false");
});

test("Отмена переименования сохраняет прежнее название группы", async ({
  page,
}) => {
  await page.goto("/groups");
  const rename = page.getByRole("button", {
    name: `Переименовать группу «${assignedGroup}»`,
  });
  await rename.click();
  const input = page.getByRole("textbox", {
    name: "Название группы",
    exact: true,
  });
  const newName = "Родные";
  await input.fill(newName);
  await expect(input).toHaveValue(newName);

  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(rename).toBeVisible();
  await page.reload();
  await expect(rename).toBeVisible();
  await expect(
    page.getByRole("button", { name: `Переименовать группу «${newName}»` }),
  ).toHaveCount(0);
});

test("Отмена удаления сохраняет группу и её участника", async ({ page }) => {
  await page.goto("/groups");
  const remove = page.getByRole("button", {
    name: `Удалить группу «${assignedGroup}»`,
  });
  await remove.click();
  const dialog = page.getByRole("dialog", {
    name: `Удалить группу «${assignedGroup}»?`,
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(dialog).toBeHidden();

  await page.reload();
  const groupRow = page.getByRole("listitem").filter({ has: remove });
  await expect(groupRow).toContainText(`${assignedGroup} — 1 контакт`);
});
