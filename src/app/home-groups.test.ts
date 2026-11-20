import { describe, expect, test } from "vitest";

import { createGroup, deleteGroup } from "@/app/actions";
import { getDb } from "@/db";
import { contacts } from "@/db/schema";
import {
  countContacts,
  getContactWithNotes,
  listContacts,
  listDueContacts,
} from "@/lib/contacts/queries";
import { formatEmptyList, formatListCounter } from "@/lib/format";
import { buildHomeUrl, parseHomeParams } from "@/lib/groups/home-params";
import { listGroups } from "@/lib/groups/queries";
import {
  addToGroup,
  insertContact,
  insertGroup,
  insertGroupWithContacts,
} from "../../test/factories";

// What the home page does for an address: reads it, asks the database for the
// list and the counter, and says what is above the list
async function openHome(params: Record<string, string>) {
  const allGroups = await listGroups();
  const { query, groupId } = parseHomeParams(
    params,
    allGroups.map((group) => group.id),
  );
  const group = allGroups.find((item) => item.id === groupId);
  const [items, total] = await Promise.all([
    listContacts(query, groupId ?? undefined),
    countContacts(groupId ?? undefined),
  ]);
  return {
    // The row of buttons: "Все", then the groups; null while there are none
    buttons: allGroups.length > 0 ? ["Все", ...allGroups.map((g) => g.name)] : null,
    selected: group?.name ?? "Все",
    names: items.map((contact) => contact.name),
    counter: formatListCounter({
      query,
      found: items.length,
      total,
      groupName: group?.name,
    }),
    empty:
      items.length === 0
        ? formatEmptyList({ query, groupName: group?.name, total })
        : null,
  };
}

describe("Ряд групп на главной", () => {
  test("Ряд появляется с первой группой", async () => {
    await insertContact("Анна");

    // No groups: no row, everything as before
    const before = await openHome({});
    expect(before.buttons).toBeNull();
    expect(before.counter).toBe("Всего 1 контакт");

    await createGroup("Теннис");

    const after = await openHome({});
    expect(after.buttons).toEqual(["Все", "Теннис"]);
    expect(after.selected).toBe("Все");
  });
});

describe("Список контактов по группе", () => {
  test("Выбрать группу", async () => {
    const { groupId } = await insertGroupWithContacts("Семья", [
      "Вера",
      "Анна",
      "Борис",
    ]);
    await insertContact("Глеб");
    await insertContact("Дина");

    const family = await openHome({ group: groupId });

    expect(family.selected).toBe("Семья");
    // By alphabet, only these three
    expect(family.names).toEqual(["Анна", "Борис", "Вера"]);
    expect(family.counter).toBe("Всего 3 контакта в группе «Семья»");

    // "Все" is the address without a group
    const all = await openHome({});
    expect(all.selected).toBe("Все");
    expect(all.names).toHaveLength(5);
    expect(all.counter).toBe("Всего 5 контактов");
  });

  test("Пустая группа на главной", async () => {
    const groupId = await insertGroup("Соседи");
    await insertContact("Анна");

    const home = await openHome({ group: groupId });

    expect(home.names).toEqual([]);
    expect(home.empty).toEqual({
      title: "В группе «Соседи» пока никого нет",
      text: "Отметьте эту группу в карточке человека или при добавлении контакта.",
    });
  });
});

describe("Поиск внутри группы", () => {
  test("Найти внутри группы", async () => {
    const { groupId } = await insertGroupWithContacts("Теннис", [
      "Анна Смирнова",
      "Борис",
    ]);
    await insertContact("Анна Петрова");

    const home = await openHome({ group: groupId, q: "Анна" });

    expect(home.names).toEqual(["Анна Смирнова"]);
    expect(home.counter).toBe("Найдено: 1 контакт из 2 в группе «Теннис»");
    // The group stays selected
    expect(home.selected).toBe("Теннис");
  });

  test("Сменить группу при набранном поиске", async () => {
    const { groupId } = await insertGroupWithContacts("Теннис", [
      "Анна Смирнова",
    ]);
    await insertContact("Анна Петрова");

    // The address of the "Все" button keeps the typed text...
    const allUrl = buildHomeUrl({ q: "Анна", group: null });
    // ...and the address of the "Теннис" button too
    const tennisUrl = buildHomeUrl({ q: "Анна", group: groupId });
    expect(new URL(allUrl, "http://x").searchParams.get("q")).toBe("Анна");
    expect(new URL(tennisUrl, "http://x").searchParams.get("q")).toBe("Анна");

    const all = await openHome({ q: "Анна" });

    expect(all.names).toEqual(["Анна Петрова", "Анна Смирнова"]);
    expect(all.counter).toBe("Найдено: 2 контакта из 2");
  });

  test("Никого не нашли в группе", async () => {
    const { groupId } = await insertGroupWithContacts("Теннис", ["Анна"]);
    await insertContact("Борис");

    const home = await openHome({ group: groupId, q: "Борис" });

    expect(home.names).toEqual([]);
    expect(home.empty?.title).toBe(
      "По запросу «Борис» в группе «Теннис» никого не нашли",
    );
  });
});

describe("Выбранная группа сохраняется в адресе страницы", () => {
  test("Вернуться из карточки в группу", async () => {
    const { groupId } = await insertGroupWithContacts("Семья", ["Анна"]);
    await insertContact("Борис");

    // The address of the "Семья" button: "Назад" and F5 open exactly it
    const url = buildHomeUrl({ group: groupId });
    const params = Object.fromEntries(new URL(url, "http://x").searchParams);
    const home = await openHome(params);

    expect(home.selected).toBe("Семья");
    expect(home.names).toEqual(["Анна"]);
  });

  test("Группу из адреса удалили", async () => {
    const { groupId } = await insertGroupWithContacts("Теннис", ["Анна"]);
    await insertContact("Борис");
    await deleteGroup(groupId);

    const home = await openHome({ group: groupId });

    expect(home.names).toEqual(["Анна", "Борис"]);
    expect(home.selected).toBe("Все");
    // No groups left: no row either
    expect(home.buttons).toBeNull();
  });
});

describe("Блок «Пора связаться» не зависит от группы", () => {
  test("Блок при выбранной группе", async () => {
    const { groupId } = await insertGroupWithContacts("Семья", ["Анна"]);
    const [stranger] = await getDb()
      .insert(contacts)
      .values({
        name: "Борис",
        contactFrequency: "week",
        contactFrequencySetAt: new Date("2020-01-01T00:00:00Z"),
      })
      .returning({ id: contacts.id });

    const before = await listDueContacts();
    // Selecting the group changes the list only: the block does not read it
    await openHome({ group: groupId });
    const after = await listDueContacts();

    expect(before.map((contact) => contact.id)).toEqual([stranger.id]);
    expect(after).toEqual(before);
  });
});

describe("Существующие контакты — без групп", () => {
  test("Первое открытие после выкатки", async () => {
    const contactId = await insertContact("Анна");
    await insertContact("Борис");

    const home = await openHome({});
    const card = await getContactWithNotes(contactId);

    // No row, the same people; "Групп пока нет" in the card's field
    expect(home.buttons).toBeNull();
    expect(home.names).toEqual(["Анна", "Борис"]);
    expect(card?.groupIds).toEqual([]);
    expect(await listGroups()).toEqual([]);
  });

  test("Человек в нескольких группах не повторяется в списке", async () => {
    const contactId = await insertContact("Анна");
    const familyId = await insertGroup("Семья");
    const tennisId = await insertGroup("Теннис");
    await addToGroup(contactId, familyId);
    await addToGroup(contactId, tennisId);

    expect((await openHome({})).names).toEqual(["Анна"]);
    expect((await openHome({ group: familyId })).names).toEqual(["Анна"]);
    expect(await countContacts(tennisId)).toBe(1);
  });
});
