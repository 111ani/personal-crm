import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import {
  createContact,
  createGroup,
  deleteContact,
  deleteGroup,
  updateContact,
} from "@/app/actions";
import { getDb } from "@/db";
import { contacts } from "@/db/schema";
import { getContactWithNotes } from "@/lib/contacts/queries";
import { formatGroupSize } from "@/lib/format";
import { listGroups } from "@/lib/groups/queries";
import {
  addToGroup,
  insertContact,
  insertGroup,
  insertGroupWithContacts,
} from "../../test/factories";
import { TEST_OWNER_ID } from "../../test/factories";

const idle = { status: "idle" } as const;

// The same data a form of the card (or of the "Новый контакт" window) sends
function contactForm(
  fields: {
    name?: string;
    phone?: string;
    groupIds?: string[];
    frequency?: string;
    days?: string;
  } = {},
) {
  const formData = new FormData();
  formData.set("name", fields.name ?? "Анна");
  formData.set("about", "");
  formData.set("howWeMet", "");
  formData.set("phone", fields.phone ?? "");
  formData.set("email", "");
  formData.set("contactFrequency", fields.frequency ?? "");
  formData.set("contactFrequencyDays", fields.days ?? "");
  // One hidden field per ticked label, as in the "Группы" field
  for (const groupId of fields.groupIds ?? []) {
    formData.append("groupIds", groupId);
  }
  return formData;
}

// The ticked labels of the card, by group id
async function tickedGroupIds(contactId: string) {
  const data = await getContactWithNotes(TEST_OWNER_ID, contactId);
  return [...(data?.groupIds ?? [])].sort();
}

const sorted = (ids: string[]) => [...ids].sort();

describe("Поле «Группы» в карточке контакта", () => {
  test("Добавить человека в две группы", async () => {
    const contactId = await insertContact("Анна");
    const friendsId = await insertGroup("Друзья");
    const tennisId = await insertGroup("Теннис");
    await insertGroup("Семья");

    const result = await updateContact(
      contactId,
      idle,
      contactForm({ groupIds: [friendsId, tennisId] }),
    );

    expect(result).toMatchObject({ status: "success", contactId });
    // After F5 the card reads the same: both labels are ticked
    expect(await tickedGroupIds(contactId)).toEqual(
      sorted([friendsId, tennisId]),
    );
  });

  test("Убрать человека из группы", async () => {
    const contactId = await insertContact("Анна");
    const friendsId = await insertGroup("Друзья");
    const tennisId = await insertGroup("Теннис");
    await addToGroup(contactId, friendsId);
    await addToGroup(contactId, tennisId);

    const result = await updateContact(
      contactId,
      idle,
      contactForm({ groupIds: [friendsId] }),
    );

    expect(result.status).toBe("success");
    expect(await tickedGroupIds(contactId)).toEqual([friendsId]);
    // The group itself stays, now without Anna
    expect(
      (await listGroups(TEST_OWNER_ID)).map(
        (group) => `${group.name} — ${formatGroupSize(group.contactCount)}`,
      ),
    ).toEqual(["Друзья — 1 контакт", "Теннис — пока никого"]);
  });

  test("Ошибка в другом поле не сбрасывает группы", async () => {
    const contactId = await insertContact("Анна");
    const familyId = await insertGroup("Семья");

    const failed = await updateContact(
      contactId,
      idle,
      contactForm({ name: "", groupIds: [familyId] }),
    );

    expect(failed).toMatchObject({
      status: "error",
      fieldErrors: { name: "Укажите имя" },
      // The form shows the ticked label again
      groupIds: [familyId],
    });
    expect(await tickedGroupIds(contactId)).toEqual([]);

    const saved = await updateContact(
      contactId,
      idle,
      contactForm({ name: "Анна", groupIds: [familyId] }),
    );

    expect(saved.status).toBe("success");
    expect(await tickedGroupIds(contactId)).toEqual([familyId]);
  });

  test("Сохранение с группами не трогает частоту: поменяли телефон — срок не сдвинулся", async () => {
    const contactId = await insertContact("Анна");
    const familyId = await insertGroup("Семья");
    await updateContact(
      contactId,
      idle,
      contactForm({ frequency: "week", groupIds: [familyId] }),
    );
    const [before] = await getDb()
      .select({ setAt: contacts.contactFrequencySetAt })
      .from(contacts)
      .where(eq(contacts.id, contactId));

    await updateContact(
      contactId,
      idle,
      contactForm({
        frequency: "week",
        phone: "+7 900 123-45-67",
        groupIds: [familyId],
      }),
    );

    const [after] = await getDb()
      .select({ setAt: contacts.contactFrequencySetAt })
      .from(contacts)
      .where(eq(contacts.id, contactId));
    expect(before.setAt).not.toBeNull();
    expect(after.setAt).toEqual(before.setAt);
  });

  test("A deleted group in an open form prevents partial contact changes", async () => {
    const contactId = await insertContact("Анна");
    const friendsId = await insertGroup("Друзья");
    const goneId = await insertGroup("Соседи");
    await deleteGroup(goneId);
    await addToGroup(contactId, friendsId);

    const result = await updateContact(
      contactId,
      idle,
      contactForm({
        name: "Анна Смирнова",
        groupIds: [friendsId, goneId],
      }),
    );

    expect(result).toMatchObject({ status: "error" });
    expect(await tickedGroupIds(contactId)).toEqual([friendsId]);
    expect(
      (await getContactWithNotes(TEST_OWNER_ID, contactId))?.contact.name,
    ).toBe("Анна");
  });

  test("Повторы и не-id в списке групп отклоняются, ничего не меняется", async () => {
    const contactId = await insertContact("Анна");
    const friendsId = await insertGroup("Друзья");
    await addToGroup(contactId, friendsId);

    const twice = await updateContact(
      contactId,
      idle,
      contactForm({ name: "Новое имя", groupIds: [friendsId, friendsId] }),
    );
    const notAnId = await updateContact(
      contactId,
      idle,
      contactForm({ name: "Новое имя", groupIds: ["не-id"] }),
    );

    expect(twice.status).toBe("error");
    expect(notAnId.status).toBe("error");
    expect(await tickedGroupIds(contactId)).toEqual([friendsId]);
    const data = await getContactWithNotes(TEST_OWNER_ID, contactId);
    expect(data?.contact.name).toBe("Анна");
  });
});

describe("Поле «Группы» в окне «Новый контакт»", () => {
  test("Добавить человека сразу в группу", async () => {
    const tennisId = await insertGroup("Теннис");

    const result = await createContact(
      idle,
      contactForm({ name: "Борис", groupIds: [tennisId] }),
    );

    expect(result.status).toBe("success");
    if (result.status !== "success") {
      return;
    }
    // The card of the new contact has "Теннис" ticked
    expect(await tickedGroupIds(result.contactId)).toEqual([tennisId]);
  });

  test("Добавить человека без групп", async () => {
    await insertGroup("Теннис");

    const result = await createContact(idle, contactForm({ name: "Борис" }));

    expect(result.status).toBe("success");
    if (result.status !== "success") {
      return;
    }
    expect(await tickedGroupIds(result.contactId)).toEqual([]);
  });

  test("Ошибка не сбрасывает группы нового контакта", async () => {
    const familyId = await insertGroup("Семья");

    const result = await createContact(
      idle,
      contactForm({ name: "", groupIds: [familyId] }),
    );

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { name: "Укажите имя" },
      groupIds: [familyId],
    });
    expect(await getDb().select().from(contacts)).toHaveLength(0);
  });
});

describe("Новая группа прямо из поля «Группы»", () => {
  test("Создать группу из карточки", async () => {
    const contactId = await insertContact("Анна");

    // "Создать" creates the group at once...
    const created = await createGroup("Аналитики");
    expect(created.status).toBe("created");
    if (created.status !== "created") {
      return;
    }
    // ...and the person gets into it on "Сохранить изменения"
    expect(await tickedGroupIds(contactId)).toEqual([]);
    await updateContact(
      contactId,
      idle,
      contactForm({ groupIds: [created.group.id] }),
    );

    expect(await tickedGroupIds(contactId)).toEqual([created.group.id]);
    expect(
      (await listGroups(TEST_OWNER_ID)).map(
        (group) => `${group.name} — ${formatGroupSize(group.contactCount)}`,
      ),
    ).toEqual(["Аналитики — 1 контакт"]);
  });

  test("Вписали название существующей группы", async () => {
    const tennisId = await insertGroup("Теннис");

    const result = await createGroup("теннис");

    // No second group; the field ticks the existing one
    expect(result).toMatchObject({ status: "exists", group: { id: tennisId } });
    expect(await listGroups(TEST_OWNER_ID)).toHaveLength(1);
  });

  test("Группа остаётся, даже если контакт не сохранили", async () => {
    // "Отмена" in the "Новый контакт" window: createContact is never called
    await createGroup("Соседи");

    expect(await getDb().select().from(contacts)).toHaveLength(0);
    expect(
      (await listGroups(TEST_OWNER_ID)).map(
        (group) => `${group.name} — ${formatGroupSize(group.contactCount)}`,
      ),
    ).toEqual(["Соседи — пока никого"]);
  });

  test("Первая группа", async () => {
    const contactId = await insertContact("Анна");

    // No groups: the field says "Групп пока нет" and offers "+ Новая группа"
    expect(await listGroups(TEST_OWNER_ID)).toEqual([]);
    expect(await tickedGroupIds(contactId)).toEqual([]);
  });
});

describe("Удалённый контакт пропадает из групп", () => {
  test("Удалить контакт из группы", async () => {
    const { groupId, contactIds } = await insertGroupWithContacts("Теннис", [
      "Анна",
      "Борис",
      "Вера",
    ]);

    // The server redirects to the list after deleting
    await expect(deleteContact(contactIds[0])).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });

    expect(
      (await listGroups(TEST_OWNER_ID)).map(
        (group) => `${group.name} — ${formatGroupSize(group.contactCount)}`,
      ),
    ).toEqual(["Теннис — 2 контакта"]);
    expect(await getDb().select().from(contacts)).toHaveLength(2);
    expect((await listGroups(TEST_OWNER_ID))[0].id).toBe(groupId);
  });
});
