// keep-in-touch: the "Связались" ticks in the home block and in the card. The
// screen itself (a double tap, "Отменить" in the message, no save button) -
// e2e/keep-in-touch.spec.ts

import { describe, expect, test } from "vitest";

import { checkIn, clearTodayCheckIns, undoCheckIn } from "@/app/actions";
import { formatDayMonth } from "@/lib/format";
import {
  ago,
  atDaysAgo,
  dayFromToday,
  insertCheckIn,
  insertContact,
  insertContactWithFrequency,
  insertDueContact,
  insertNote,
} from "../../test/factories";
import { dueLineIn, openCard, openDueBlock } from "../../test/keep-in-touch";

async function checkInOrFail(contactId: string) {
  const result = await checkIn(contactId);
  if (result.status !== "success") {
    throw new Error(`Check-in failed: ${result.message}`);
  }
  return result.checkInId;
}

describe("Галочка «Связались» в блоке «Пора связаться»", () => {
  test("Отметить из блока", async () => {
    const annaId = await insertDueContact("Анна");
    const borisId = await insertDueContact("Борис");
    expect((await openDueBlock()).title).toBe("Пора связаться · 2");

    await checkInOrFail(annaId);

    const block = await openDueBlock();
    expect(block.title).toBe("Пора связаться · 1");
    expect(block.ids).toEqual([borisId]);
    const card = await openCard(annaId);
    // The one note from before, no new one
    expect(card.noteCount).toBe(1);
    expect(card.dueLine).toBe(await dueLineIn("7 days"));
  });

  test("Отметили последнего — блока нет", async () => {
    const contactId = await insertDueContact("Анна");

    await checkInOrFail(contactId);

    expect((await openDueBlock()).title).toBeNull();
  });
});

describe("Отметку из блока можно отменить", () => {
  test("Отменить отметку из блока", async () => {
    await insertDueContact("Анна", "30 days");
    const borisId = await insertDueContact("Борис", "20 days");
    await insertDueContact("Вера", "10 days");
    const before = await openDueBlock();
    expect(before.lines).toEqual([
      "Анна: раз в неделю · просрочено на 3 недели",
      "Борис: раз в неделю · просрочено на 13 дней",
      "Вера: раз в неделю · просрочено на 3 дня",
    ]);

    const checkInId = await checkInOrFail(borisId);
    expect((await openDueBlock()).ids).not.toContain(borisId);
    await undoCheckIn(checkInId);

    // Back in its place, with the same caption and the same count
    expect(await openDueBlock()).toEqual(before);
  });
});

describe("Галочка «Связались сегодня» в карточке контакта", () => {
  test("Отметить в карточке", async () => {
    const contactId = await insertDueContact("Анна");
    const before = await openCard(contactId);
    expect(before.dueLine).toMatch(/^Пора связаться — /);
    expect(before.checkIn).toEqual({ checked: false, lastCheckIn: null });

    await checkInOrFail(contactId);

    // Read again from the database: as after F5
    const card = await openCard(contactId);
    expect(card.dueLine).toBe(await dueLineIn("7 days"));
    expect(card.checkIn).toEqual({ checked: true, lastCheckIn: null });
    expect(card.noteCount).toBe(before.noteCount);
    expect((await openDueBlock()).ids).not.toContain(contactId);
  });

  test("Отметка из блока видна в карточке", async () => {
    const contactId = await insertDueContact("Анна");

    // The tick in the block saves with the same action as the one in the card
    await checkInOrFail(contactId);

    expect((await openCard(contactId)).checkIn?.checked).toBe(true);
  });

  test("Без частоты галочки нет", async () => {
    const contactId = await insertContact("Анна");
    await insertNote(contactId, ago("1 year"));

    const card = await openCard(contactId);
    expect(card.checkIn).toBeNull();
    expect(card.dueLine).toBeNull();
  });
});

describe("Галочку в карточке можно снять в тот же день", () => {
  test("Снять галочку в тот же день", async () => {
    const contactId = await insertDueContact("Анна");
    const before = await openCard(contactId);

    await checkInOrFail(contactId);
    await clearTodayCheckIns(contactId);

    const card = await openCard(contactId);
    expect(card.dueLine).toBe(before.dueLine);
    expect(card.checkIn).toEqual({ checked: false, lastCheckIn: null });
    expect((await openDueBlock()).ids).toContain(contactId);
  });

  test("Снять галочку: убираются только сегодняшние отметки", async () => {
    const contactId = await insertContactWithFrequency("Анна", {
      frequency: "month",
      setAt: ago("1 year"),
    });
    await insertCheckIn(contactId, atDaysAgo(3, "12:00"));
    const before = await openCard(contactId);

    await checkInOrFail(contactId);
    await checkInOrFail(contactId);
    await clearTodayCheckIns(contactId);

    // The check-in of 3 days ago stays and counts again
    expect(await openCard(contactId)).toEqual(before);
  });

  test("Отметка в другой день", async () => {
    const contactId = await insertContactWithFrequency("Анна", {
      frequency: "week",
      setAt: ago("1 month"),
    });
    // Ticked yesterday at noon
    await insertCheckIn(contactId, atDaysAgo(1, "12:00"));

    const yesterday = formatDayMonth(await dayFromToday("-1 day"), new Date());
    expect((await openCard(contactId)).checkIn).toEqual({
      checked: false,
      lastCheckIn: `Последняя отметка — ${yesterday}`,
    });
  });
});
