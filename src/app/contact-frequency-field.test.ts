// keep-in-touch: the "Как часто общаться" field and the due date while there
// were neither notes nor check-ins. The screen itself (no field in the "Новый
// контакт" window, "Изменения сохранены") - e2e/keep-in-touch.spec.ts

import { describe, expect, test } from "vitest";

import { createContact, updateContact } from "@/app/actions";
import {
  ago,
  insertContact,
  insertContactWithFrequency,
  insertDueContact,
} from "../../test/factories";
import {
  cardForm,
  dueLineIn,
  idle,
  openCard,
  openDueBlock,
} from "../../test/keep-in-touch";

// The "Новый контакт" window has no frequency field, so it does not send one
function newContactForm(name: string) {
  const formData = new FormData();
  formData.set("name", name);
  formData.set("about", "");
  formData.set("howWeMet", "");
  formData.set("phone", "");
  formData.set("email", "");
  return formData;
}

describe("Частота общения задаётся в карточке контакта", () => {
  test("Задать частоту", async () => {
    const contactId = await insertContact("Анна");

    const result = await updateContact(
      contactId,
      idle,
      cardForm({ frequency: "month" }),
    );

    // Success is what shows "Изменения сохранены"
    expect(result.status).toBe("success");
    // Read again from the database: after F5 and in another browser alike
    expect((await openCard(contactId)).frequency).toBe("month");
  });

  test("Убрать частоту", async () => {
    const contactId = await insertDueContact("Анна");
    expect((await openDueBlock()).ids).toContain(contactId);

    await updateContact(contactId, idle, cardForm({ frequency: "" }));

    const card = await openCard(contactId);
    expect(card.frequency).toBe("");
    expect(card.dueLine).toBeNull();
    expect(card.checkIn).toBeNull();
    expect((await openDueBlock()).ids).not.toContain(contactId);
  });

  test("Новый контакт без частоты", async () => {
    const result = await createContact(idle, newContactForm("Дмитрий"));
    if (result.status !== "success") {
      throw new Error(`Contact not created: ${result.status}`);
    }

    const card = await openCard(result.contactId);
    expect(card.frequency).toBe("");
    expect(card.dueLine).toBeNull();
  });
});

describe("Своё число дней", () => {
  test("Задать своё число дней", async () => {
    const contactId = await insertContact("Анна");

    const result = await updateContact(
      contactId,
      idle,
      cardForm({ frequency: "days", days: "3" }),
    );

    expect(result.status).toBe("success");
    const card = await openCard(contactId);
    expect(card.frequency).toBe("days");
    expect(card.days).toBe(3);
    expect(card.dueLine).toBe(await dueLineIn("3 days"));
  });

  test.each(["", "0", "400", "-3", "2.5", "abc"])(
    "Неверное число дней: «%s»",
    async (days) => {
      const contactId = await insertContactWithFrequency("Анна", {
        frequency: "week",
      });
      const before = await openCard(contactId);

      const result = await updateContact(
        contactId,
        idle,
        cardForm({ frequency: "days", days }),
      );

      expect(result).toMatchObject({
        status: "error",
        frequencyError: "Укажите число дней — от 1 до 365",
        // What was chosen and typed comes back to the form as it was
        frequency: { frequency: "days", days },
      });
      expect(await openCard(contactId)).toEqual(before);
    },
  );
});

describe("Без общения срок считается с момента, когда задали частоту", () => {
  test("Новый знакомый не попадает в блок сразу", async () => {
    const created = await createContact(idle, newContactForm("Дмитрий"));
    if (created.status !== "success") {
      throw new Error(`Contact not created: ${created.status}`);
    }

    await updateContact(
      created.contactId,
      idle,
      cardForm({ name: "Дмитрий", frequency: "week" }),
    );

    expect((await openCard(created.contactId)).dueLine).toBe(
      await dueLineIn("7 days"),
    );
    expect((await openDueBlock()).ids).not.toContain(created.contactId);
  });

  test("Смена частоты считает срок заново", async () => {
    // "Раз в неделю" set 10 days ago: already due
    const contactId = await insertContactWithFrequency("Анна", {
      frequency: "week",
      setAt: ago("10 days"),
    });
    expect((await openCard(contactId)).dueLine).toMatch(/^Пора связаться/);

    await updateContact(contactId, idle, cardForm({ frequency: "month" }));

    expect((await openCard(contactId)).dueLine).toBe(
      await dueLineIn("1 month"),
    );
    expect((await openDueBlock()).ids).not.toContain(contactId);
  });

  test("Другое число дней считает срок заново", async () => {
    const contactId = await insertContactWithFrequency("Анна", {
      frequency: "days",
      days: 3,
      setAt: ago("1 day"),
    });
    expect((await openCard(contactId)).dueLine).toBe(await dueLineIn("2 days"));

    await updateContact(
      contactId,
      idle,
      cardForm({ frequency: "days", days: "5" }),
    );

    expect((await openCard(contactId)).dueLine).toBe(await dueLineIn("5 days"));
  });

  test.each([
    { option: "Раз в неделю", frequency: "week", days: null, left: "4 days" },
    { option: "Каждые 10 дней", frequency: "days", days: 10, left: "7 days" },
  ] as const)(
    "Правка других полей не сдвигает срок: $option",
    async ({ frequency, days, left }) => {
      // Set 3 days ago
      const contactId = await insertContactWithFrequency("Анна", {
        frequency,
        days,
        setAt: ago("3 days"),
      });
      const before = await openCard(contactId);
      expect(before.dueLine).toBe(await dueLineIn(left));

      await updateContact(
        contactId,
        idle,
        cardForm({
          frequency,
          days: days?.toString() ?? "",
          phone: "+7 900 123-45-67",
        }),
      );

      expect((await openCard(contactId)).dueLine).toBe(before.dueLine);
    },
  );
});
