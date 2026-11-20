import { describe, expect, test } from "vitest";

import { buildHomeUrl, parseHomeParams } from "@/lib/groups/home-params";

const familyId = "7f1d8c0e-2b5a-4a53-9f55-3a3f6f2a1c01";
const tennisId = "0c9a5d7e-6c31-4b8e-8f0a-5e9d1b7c2a02";
const knownIds = [familyId, tennisId];

describe("адрес главной: разбор", () => {
  test("пустой адрес — всё, без поиска", () => {
    expect(parseHomeParams({}, knownIds)).toEqual({ query: "", groupId: null });
  });

  test("известная группа и поиск", () => {
    expect(
      parseHomeParams({ q: "  Анна ", group: tennisId }, knownIds),
    ).toEqual({ query: "Анна", groupId: tennisId });
  });

  test("группы из адреса нет в списке — группа не выбрана", () => {
    expect(
      parseHomeParams({ group: "0c9a5d7e-6c31-4b8e-8f0a-5e9d1b7c2a99" }, knownIds),
    ).toEqual({ query: "", groupId: null });
  });

  test("в адресе не id — группа не выбрана", () => {
    expect(parseHomeParams({ group: "теннис" }, knownIds).groupId).toBeNull();
    expect(parseHomeParams({ group: "" }, knownIds).groupId).toBeNull();
  });

  test("повторённый параметр не принимается", () => {
    expect(
      parseHomeParams({ q: ["a", "b"], group: [familyId, tennisId] }, knownIds),
    ).toEqual({ query: "", groupId: null });
  });
});

describe("адрес главной: сборка", () => {
  test("ничего не выбрано — просто главная", () => {
    expect(buildHomeUrl({})).toBe("/");
    expect(buildHomeUrl({ q: "", group: null })).toBe("/");
  });

  test("только группа", () => {
    expect(buildHomeUrl({ group: familyId })).toBe(`/?group=${familyId}`);
  });

  test("только поиск — как раньше", () => {
    expect(buildHomeUrl({ q: "Анна" })).toBe(
      `/?q=${encodeURIComponent("Анна")}`,
    );
  });

  test("группа и поиск вместе", () => {
    expect(buildHomeUrl({ q: "Анна Смирнова", group: tennisId })).toBe(
      `/?group=${tennisId}&q=${encodeURIComponent("Анна Смирнова")}`,
    );
  });

  test("собранный адрес разбирается обратно", () => {
    const url = buildHomeUrl({ q: "Анна & Ко", group: familyId });
    const params = Object.fromEntries(new URL(url, "http://x").searchParams);

    expect(parseHomeParams(params, knownIds)).toEqual({
      query: "Анна & Ко",
      groupId: familyId,
    });
  });
});
