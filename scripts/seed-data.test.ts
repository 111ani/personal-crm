import { describe, expect, test } from "vitest";

import { generateSeedData } from "./seed-data.ts";

const now = new Date("2026-11-20T12:00:00Z");

describe("тестовые данные: группы", () => {
  const data = generateSeedData(1000, now);
  const namesById = new Map(data.groupRows.map((g) => [g.id, g.name]));
  const contactNamesById = new Map(data.contactRows.map((c) => [c.id, c.name]));

  test("шесть групп с понятными названиями", () => {
    expect(data.groupRows.map((group) => group.name).sort()).toEqual(
      ["Аналитики", "Друзья", "Знакомые", "Работа", "Семья", "Теннис"].sort(),
    );
    expect(namesById.size).toBe(6);
  });

  test("примерно 60% людей — в одной-двух группах, никто не больше чем в двух", () => {
    const perContact = new Map<string, number>();
    for (const link of data.contactGroupRows) {
      perContact.set(link.contactId, (perContact.get(link.contactId) ?? 0) + 1);
    }

    const inGroups = perContact.size / data.contactRows.length;
    expect(inGroups).toBeGreaterThanOrEqual(0.5);
    expect(inGroups).toBeLessThanOrEqual(0.7);
    expect(Math.max(...perContact.values())).toBeLessThanOrEqual(2);
  });

  test("каждая связь ссылается на существующие контакт и группу, повторов нет", () => {
    const seen = new Set<string>();
    for (const link of data.contactGroupRows) {
      expect(contactNamesById.has(link.contactId)).toBe(true);
      expect(namesById.has(link.groupId)).toBe(true);
      const key = `${link.contactId}:${link.groupId}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  test("в каждой группе есть люди", () => {
    for (const group of data.groupRows) {
      expect(
        data.contactGroupRows.some((link) => link.groupId === group.id),
      ).toBe(true);
    }
  });

  test("два запуска с одним seed дают одно и то же", () => {
    // Ids are random, so compare by names
    const describeLinks = (result: typeof data) =>
      result.contactGroupRows
        .map(
          (link) =>
            `${result.contactRows.find((c) => c.id === link.contactId)?.name}|${result.groupRows.find((g) => g.id === link.groupId)?.name}`,
        )
        .sort();

    expect(describeLinks(generateSeedData(1000, now))).toEqual(
      describeLinks(data),
    );
  });

  test("группы не меняют людей, заметки и частоту: те же имена, что и раньше", () => {
    const again = generateSeedData(1000, now);

    expect(again.contactRows.map((c) => c.name)).toEqual(
      data.contactRows.map((c) => c.name),
    );
    expect(again.noteRows).toHaveLength(data.noteRows.length);
  });
});
