import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { getDb } from "@/db";
import { contactGroups, contacts, groups } from "@/db/schema";

import {
  insertContact as createContact,
  insertGroup as createGroup,
} from "../../test/factories";

describe("таблицы групп", () => {
  test("в базу нельзя записать группы «Теннис» и «теннис», а «Теннис» и «Семья» — можно", async () => {
    await createGroup("Теннис");

    await expect(createGroup("теннис")).rejects.toThrow();
    await expect(createGroup("Семья")).resolves.toBeTypeOf("string");
    expect(await getDb().select().from(groups)).toHaveLength(2);
  });

  test("удаление контакта удаляет его связи с группами, группа остаётся", async () => {
    const contactId = await createContact("Анна");
    const groupId = await createGroup("Теннис");
    await getDb().insert(contactGroups).values({ contactId, groupId });

    await getDb().delete(contacts).where(eq(contacts.id, contactId));

    expect(await getDb().select().from(contactGroups)).toHaveLength(0);
    expect(await getDb().select().from(groups)).toHaveLength(1);
  });

  test("удаление группы удаляет связи, контакт остаётся", async () => {
    const contactId = await createContact("Анна");
    const groupId = await createGroup("Теннис");
    await getDb().insert(contactGroups).values({ contactId, groupId });

    await getDb().delete(groups).where(eq(groups.id, groupId));

    expect(await getDb().select().from(contactGroups)).toHaveLength(0);
    expect(await getDb().select().from(contacts)).toHaveLength(1);
  });
});
