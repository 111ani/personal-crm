// keep-in-touch: what the due date counts from - notes, check-ins, the start
// of the day - and the due line in the card

import { describe, expect, test } from "vitest";

import { addNote, checkIn, updateContact } from "@/app/actions";
import {
  ago,
  atDaysAgo,
  insertContact,
  insertContactWithFrequency,
  insertDueContact,
  insertNote,
} from "../../test/factories";
import {
  cardForm,
  dueLineIn,
  idle,
  openCard,
  openDueBlock,
} from "../../test/keep-in-touch";

function noteForm(body: string) {
  const formData = new FormData();
  formData.set("body", body);
  return formData;
}

describe("Срок считается от последнего общения", () => {
  test("Срок по календарю", async () => {
    // The frequency is set now, but the note is older: the note counts
    const contactId = await insertContactWithFrequency("Анна", {
      frequency: "quarter",
    });
    await insertNote(contactId, new Date("2026-08-15T19:40:00Z"));

    const card = await openCard(contactId);
    // Three calendar months, not 90 days (that would be 13 November)
    expect(card.dueAt).toEqual(new Date("2026-11-15T00:00:00Z"));
    // 15 November 2026 has passed by now
    expect(card.dueLine).toMatch(/^Пора связаться — просрочено на /);
  });

  test("Давняя заметка — сразу пора связаться", async () => {
    const contactId = await insertContact("Анна");
    await insertNote(contactId, ago("15 days"));

    await updateContact(contactId, idle, cardForm({ frequency: "week" }));

    expect((await openCard(contactId)).dueLine).toBe(
      "Пора связаться — просрочено на 8 дней",
    );
    expect((await openDueBlock()).ids).toContain(contactId);
  });

  test("Отметка позже заметки", async () => {
    const contactId = await insertContactWithFrequency("Анна", {
      frequency: "month",
      setAt: ago("3 months"),
    });
    await insertNote(contactId, ago("2 months"));

    await checkIn(contactId);

    expect((await openCard(contactId)).dueLine).toBe(
      await dueLineIn("1 month"),
    );
  });
});

describe("Срок наступает с начала дня", () => {
  // Late-evening notes: counted to the minute, a week would end only at 23:50
  // of the due day. A week, not a quarter, so month lengths do not matter
  async function contactWithNoteDaysAgo(days: number) {
    const contactId = await insertContactWithFrequency("Анна", {
      frequency: "week",
      setAt: ago("1 month"),
    });
    await insertNote(contactId, atDaysAgo(days, "23:50"));
    return contactId;
  }

  test("Весь день срока — «срок сегодня»: накануне", async () => {
    const contactId = await contactWithNoteDaysAgo(6);

    expect((await openCard(contactId)).dueLine).toBe(
      await dueLineIn("1 day"),
    );
    expect((await openDueBlock()).ids).not.toContain(contactId);
  });

  test("Весь день срока — «срок сегодня»: день срока с самого утра", async () => {
    const contactId = await contactWithNoteDaysAgo(7);

    expect((await openCard(contactId)).dueLine).toBe(
      "Пора связаться — срок сегодня",
    );
    expect((await openDueBlock()).ids).toContain(contactId);
  });

  test("Весь день срока — «срок сегодня»: на следующий день", async () => {
    const contactId = await contactWithNoteDaysAgo(8);

    expect((await openCard(contactId)).dueLine).toBe(
      "Пора связаться — просрочено на 1 день",
    );
  });
});

describe("Новая заметка начинает срок заново", () => {
  test("Написали заметку — контакт ушёл из блока", async () => {
    const annaId = await insertDueContact("Анна");
    await insertDueContact("Борис");
    expect((await openDueBlock()).title).toBe("Пора связаться · 2");

    const result = await addNote(annaId, idle, noteForm("Обсудили отпуск"));

    expect(result.status).toBe("success");
    expect((await openCard(annaId)).dueLine).toBe(await dueLineIn("7 days"));
    const block = await openDueBlock();
    expect(block.title).toBe("Пора связаться · 1");
    expect(block.ids).not.toContain(annaId);
  });

  test("Правка данных — не общение", async () => {
    const contactId = await insertDueContact("Анна");
    const before = await openCard(contactId);
    expect(before.dueLine).toBe("Пора связаться — просрочено на 8 дней");

    await updateContact(
      contactId,
      idle,
      cardForm({ frequency: "week", about: "Тренер по теннису" }),
    );

    expect((await openCard(contactId)).dueLine).toBe(before.dueLine);
    expect((await openDueBlock()).ids).toContain(contactId);
  });
});

describe("Срок в карточке контакта", () => {
  test("Срок ещё не наступил", async () => {
    const contactId = await insertContactWithFrequency("Анна", {
      frequency: "week",
      setAt: ago("1 month"),
    });
    await insertNote(contactId);

    expect((await openCard(contactId)).dueLine).toBe(
      await dueLineIn("7 days"),
    );
  });

  test("Срок прошёл", async () => {
    const contactId = await insertContactWithFrequency("Анна", {
      frequency: "month",
      setAt: ago("3 months"),
    });
    await insertNote(contactId, ago("2 months"));

    const [row] = (await openDueBlock()).rows;
    expect(row.id).toBe(contactId);
    // The same overdue as in the block on the home page
    expect((await openCard(contactId)).dueLine).toBe(
      `Пора связаться — ${row.overdue}`,
    );
  });

  test("Год в дате", async () => {
    const contactId = await insertContact("Анна");
    await updateContact(contactId, idle, cardForm({ frequency: "year" }));

    await addNote(contactId, idle, noteForm("Поздравил с днём рождения"));

    const dueLine = (await openCard(contactId)).dueLine;
    expect(dueLine).toBe(await dueLineIn("1 year"));
    // "Связаться до 24 октября 2027": next year, so the year is written
    expect(dueLine).toMatch(new RegExp(` ${new Date().getFullYear() + 1}$`));
  });
});
