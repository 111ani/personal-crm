// keep-in-touch: who is in "Пора связаться" on the home page, the captions and
// the order. The screen itself (hidden while searching, "Показать всех",
// opening the card) - e2e/keep-in-touch.spec.ts

import { describe, expect, test } from "vitest";

import { updateContact } from "@/app/actions";
import {
  ago,
  atDaysAgo,
  insertContact,
  insertContactWithFrequency,
  insertDueContact,
  insertNote,
} from "../../test/factories";
import { cardForm, idle, openDueBlock } from "../../test/keep-in-touch";

async function contactWithLastNote(name: string, lastNoteAgo: string) {
  const contactId = await insertContact(name);
  await insertNote(contactId, ago(lastNoteAgo));
  return contactId;
}

describe("Блок «Пора связаться» на главной", () => {
  test("Блок показывает просроченные контакты", async () => {
    const people = [
      { name: "Анна", lastNoteAgo: "15 days" },
      { name: "Борис", lastNoteAgo: "30 days" },
      { name: "Вера", lastNoteAgo: "20 days" },
    ];
    for (const { name, lastNoteAgo } of people) {
      const contactId = await contactWithLastNote(name, lastNoteAgo);
      await updateContact(contactId, idle, cardForm({ name, frequency: "week" }));
    }
    // An old note but no frequency: never in the block
    await contactWithLastNote("Глеб", "1 year");

    const block = await openDueBlock();
    expect(block.title).toBe("Пора связаться · 3");
    expect(block.lines).toEqual([
      "Борис: раз в неделю · просрочено на 3 недели",
      "Вера: раз в неделю · просрочено на 13 дней",
      "Анна: раз в неделю · просрочено на 8 дней",
    ]);
  });

  test("Никого не пора — блока нет", async () => {
    await contactWithLastNote("Анна", "1 year");
    // A frequency, but the due date has not come
    const borisId = await insertContactWithFrequency("Борис", {
      frequency: "week",
      setAt: ago("1 month"),
    });
    await insertNote(borisId);

    expect((await openDueBlock()).title).toBeNull();
  });
});

describe("Как пишется частота в днях", () => {
  test("Подпись в блоке", async () => {
    const contactId = await insertContactWithFrequency("Анна", {
      frequency: "days",
      days: 3,
      setAt: ago("1 month"),
    });
    // Three days ago: due today
    await insertNote(contactId, atDaysAgo(3, "12:00"));

    expect((await openDueBlock()).lines).toEqual([
      "Анна: раз в 3 дня · срок сегодня",
    ]);
  });
});

describe("Самые просроченные — сверху", () => {
  test("Порядок в блоке", async () => {
    // Added out of order; names do not follow the order either
    await insertDueContact("Вера", "30 days");
    await insertDueContact("Борис", "10 days");
    await insertDueContact("Яна", "400 days");
    await insertDueContact("Глеб", "100 days");
    // Due today: a week after a note 7 days ago at noon
    const todayId = await insertContactWithFrequency("Дина", {
      frequency: "week",
      setAt: ago("1 month"),
    });
    await insertNote(todayId, atDaysAgo(7, "12:00"));
    // The same due day: by name
    await insertDueContact("Фёдор", "20 days");
    await insertDueContact("Алла", "20 days");

    expect((await openDueBlock()).lines).toEqual([
      "Яна: раз в неделю · просрочено на 1 год",
      "Глеб: раз в неделю · просрочено на 3 месяца",
      "Вера: раз в неделю · просрочено на 3 недели",
      "Алла: раз в неделю · просрочено на 13 дней",
      "Фёдор: раз в неделю · просрочено на 13 дней",
      "Борис: раз в неделю · просрочено на 3 дня",
      "Дина: раз в неделю · срок сегодня",
    ]);
  });

  test("Редкая частота с большой просрочкой выше", async () => {
    // Contact А of the spec is Яна: last by name, so only the overdue can put
    // her first
    const yanaId = await insertContactWithFrequency("Яна", {
      frequency: "year",
      setAt: ago("2 years"),
    });
    await insertNote(yanaId, ago("13 months"));
    await insertDueContact("Борис", "3 weeks");

    expect((await openDueBlock()).lines).toEqual([
      "Яна: раз в год · просрочено на 4 недели",
      "Борис: раз в неделю · просрочено на 2 недели",
    ]);
  });
});
