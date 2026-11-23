import { describe, expect, test } from "vitest";

import {
  formatEmptyList,
  formatGroupSize,
  formatListCounter,
} from "@/lib/format";

describe("подпись размера группы", () => {
  test("в группе никого нет — «пока никого»", () => {
    expect(formatGroupSize(0)).toBe("пока никого");
  });

  test.each([
    [1, "1 контакт"],
    [2, "2 контакта"],
    [4, "4 контакта"],
    [5, "5 контактов"],
    [11, "11 контактов"],
    [21, "21 контакт"],
  ])("в группе %i — «%s»", (count, expected) => {
    expect(formatGroupSize(count)).toBe(expected);
  });
});

describe("счётчик над списком контактов", () => {
  test("без группы и поиска", () => {
    expect(formatListCounter({ query: "", found: 5, total: 5 })).toBe(
      "Всего 5 контактов",
    );
  });

  test("без группы, с поиском — как раньше", () => {
    expect(formatListCounter({ query: "Анна", found: 2, total: 5 })).toBe(
      "Найдено: 2 контакта из 5",
    );
  });

  test("в группе", () => {
    expect(
      formatListCounter({ query: "", found: 3, total: 3, groupName: "Семья" }),
    ).toBe("Всего 3 контакта в группе «Семья»");
  });

  test("поиск внутри группы: из скольких всего в группе", () => {
    expect(
      formatListCounter({
        query: "Анна",
        found: 1,
        total: 2,
        groupName: "Теннис",
      }),
    ).toBe("Найдено: 1 контакт из 2 в группе «Теннис»");
  });
});

describe("когда список пуст", () => {
  test("в группе никого нет", () => {
    expect(
      formatEmptyList({ query: "", groupName: "Соседи", total: 0 }),
    ).toEqual({
      title: "В группе «Соседи» пока никого нет",
      text: "Отметьте эту группу в карточке человека или при добавлении контакта.",
    });
  });

  test("в группе никого не нашли", () => {
    expect(
      formatEmptyList({ query: "Борис", groupName: "Теннис", total: 2 }).title,
    ).toBe("По запросу «Борис» в группе «Теннис» никого не нашли");
  });

  test("без группы — как раньше", () => {
    expect(formatEmptyList({ query: "Борис", total: 5 })).toEqual({
      title: "По запросу «Борис» никого не нашли",
      text: "Проверьте, как написано имя, или добавьте новый контакт.",
    });
  });
});
