import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { createGroup, deleteGroup, renameGroup } from "@/app/actions";
import { getDb } from "@/db";
import { contactGroups, contacts } from "@/db/schema";
import { formatGroupSize } from "@/lib/format";
import { listGroups } from "@/lib/groups/queries";
import {
  addToGroup,
  insertGroup,
  insertGroupWithContacts,
} from "../../test/factories";

// What a row of the "Группы" page says: "Теннис — 4 контакта"
async function groupRows() {
  const list = await listGroups();
  return list.map(
    (group) => `${group.name} — ${formatGroupSize(group.contactCount)}`,
  );
}

describe("Страница «Группы»", () => {
  test("Открыть страницу «Группы»", async () => {
    await insertGroupWithContacts("Теннис", ["Анна", "Борис", "Вера", "Глеб"]);
    await insertGroupWithContacts("семья", ["Дина", "Егор"]);
    await insertGroup("Аналитики");

    // By alphabet, letter case aside; each with the number of people
    expect(await groupRows()).toEqual([
      "Аналитики — пока никого",
      "семья — 2 контакта",
      "Теннис — 4 контакта",
    ]);
  });

  test("Пустая группа", async () => {
    const result = await createGroup("Соседи");

    expect(result.status).toBe("created");
    expect(await groupRows()).toEqual(["Соседи — пока никого"]);
  });
});

describe("Создать группу", () => {
  test("Создать группу", async () => {
    await insertGroup("Семья");

    const result = await createGroup("Теннис");

    expect(result).toMatchObject({
      status: "created",
      group: { name: "Теннис" },
    });
    // On its place by alphabet, with nobody in it; the home row and the
    // "Группы" field of every card read the same list
    expect(await groupRows()).toEqual([
      "Семья — пока никого",
      "Теннис — пока никого",
    ]);
  });

  test("Пробелы по краям названия отбрасываются", async () => {
    const result = await createGroup("   Теннис   ");

    expect(result).toMatchObject({
      status: "created",
      group: { name: "Теннис" },
    });
  });

  test("Пустое название", async () => {
    for (const name of ["", "   "]) {
      const result = await createGroup(name);

      expect(result).toEqual({
        status: "error",
        message: "Укажите название группы",
      });
    }
    expect(await listGroups()).toHaveLength(0);
  });

  test("Слишком длинное название", async () => {
    const result = await createGroup("а".repeat(51));

    expect(result).toEqual({
      status: "error",
      message: "Название слишком длинное — до 50 символов",
    });
    expect(await listGroups()).toHaveLength(0);

    // 50 is still fine
    expect((await createGroup("а".repeat(50))).status).toBe("created");
  });
});

describe("Названия групп не повторяются", () => {
  test("Такая группа уже есть", async () => {
    await insertGroup("Теннис");

    const result = await createGroup(" теннис ");

    expect(result).toMatchObject({
      status: "exists",
      message: "Группа «Теннис» уже есть",
      group: { name: "Теннис" },
    });
    expect(await groupRows()).toEqual(["Теннис — пока никого"]);
  });
});

describe("Переименовать группу", () => {
  test("Переименовать группу", async () => {
    const { groupId, contactIds } = await insertGroupWithContacts("Тенис", [
      "Анна",
      "Борис",
      "Вера",
    ]);

    const result = await renameGroup(groupId, "Теннис");

    expect(result).toEqual({ status: "success" });
    expect(await groupRows()).toEqual(["Теннис — 3 контакта"]);
    // The same three people are still in the same group
    const links = await getDb()
      .select({ contactId: contactGroups.contactId })
      .from(contactGroups)
      .where(eq(contactGroups.groupId, groupId));
    expect(links.map((link) => link.contactId).sort()).toEqual(
      [...contactIds].sort(),
    );
  });

  test("Переименовать, только поменяв регистр букв, можно: это та же группа", async () => {
    const groupId = await insertGroup("теннис");

    const result = await renameGroup(groupId, "Теннис");

    expect(result).toEqual({ status: "success" });
    expect(await groupRows()).toEqual(["Теннис — пока никого"]);
  });

  test("Пустое и слишком длинное название при переименовании", async () => {
    const groupId = await insertGroup("Теннис");

    expect(await renameGroup(groupId, "  ")).toEqual({
      status: "error",
      message: "Укажите название группы",
    });
    expect(await renameGroup(groupId, "б".repeat(51))).toEqual({
      status: "error",
      message: "Название слишком длинное — до 50 символов",
    });
    expect(await groupRows()).toEqual(["Теннис — пока никого"]);
  });

  test("Переименовать в занятое название", async () => {
    await insertGroup("Семья");
    const friendsId = await insertGroup("Друзья");

    const result = await renameGroup(friendsId, "семья");

    expect(result).toEqual({
      status: "error",
      message: "Группа «Семья» уже есть",
    });
    expect(await groupRows()).toEqual([
      "Друзья — пока никого",
      "Семья — пока никого",
    ]);
  });
});

describe("Удалить группу", () => {
  test("Удалить группу с людьми", async () => {
    const { groupId: tennisId, contactIds } = await insertGroupWithContacts(
      "Теннис",
      ["Анна", "Борис"],
    );
    const friendsId = await insertGroup("Друзья");
    const [anna] = contactIds;
    await addToGroup(anna, friendsId);

    const result = await deleteGroup(tennisId);

    expect(result).toEqual({ status: "success" });
    expect(await groupRows()).toEqual(["Друзья — 1 контакт"]);
    // Both people are still contacts; Anna is still in "Друзья" only
    expect(await getDb().select().from(contacts)).toHaveLength(2);
    const annaLinks = await getDb()
      .select({ groupId: contactGroups.groupId })
      .from(contactGroups)
      .where(eq(contactGroups.contactId, anna));
    expect(annaLinks).toEqual([{ groupId: friendsId }]);
  });

  test("Удалить уже удалённую группу — не ошибка", async () => {
    const groupId = await insertGroup("Теннис");
    await deleteGroup(groupId);

    expect(await deleteGroup(groupId)).toEqual({ status: "success" });
  });
});
