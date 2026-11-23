import { describe, expect, test } from "vitest";

import { contactFrequencies } from "@/lib/contacts/frequency";
import {
  dayForms,
  formatDayMonth,
  formatEmptyList,
  formatFrequency,
  formatFrequencyOption,
  formatGroupSize,
  formatListCounter,
  formatOverdue,
  pluralize,
} from "@/lib/format";

describe("Как пишется «просрочено на…»", () => {
  test.each([
    [0, "срок сегодня"],
    [3, "просрочено на 3 дня"],
    [20, "просрочено на 2 недели"],
    [75, "просрочено на 2 месяца"],
    [400, "просрочено на 1 год"],
  ])("Примеры подписей: %i дн. — «%s»", (days, expected) => {
    expect(formatOverdue(days)).toBe(expected);
  });

  test.each([
    [1, "просрочено на 1 день"],
    [5, "просрочено на 5 дней"],
    [13, "просрочено на 13 дней"],
    [14, "просрочено на 2 недели"],
    [59, "просрочено на 8 недель"],
    [60, "просрочено на 2 месяца"],
    [364, "просрочено на 12 месяцев"],
    [365, "просрочено на 1 год"],
    [800, "просрочено на 2 года"],
    [2000, "просрочено на 5 лет"],
  ])("на границах: %i дн. — «%s»", (days, expected) => {
    expect(formatOverdue(days)).toBe(expected);
  });
});

describe("Как пишется частота", () => {
  test("варианты в поле «Как часто общаться»", () => {
    expect(contactFrequencies.map(formatFrequencyOption)).toEqual([
      "Раз в неделю",
      "Раз в месяц",
      "Раз в квартал",
      "Раз в год",
      "Каждые … дней",
    ]);
  });

  test.each([
    [3, "дня"],
    [5, "дней"],
    [21, "день"],
  ])("Своё число дней: слово у окошка — «Каждые [%i] %s»", (days, word) => {
    expect(pluralize(days, dayForms)).toBe(word);
  });

  test.each([
    [3, "раз в 3 дня"],
    [5, "раз в 5 дней"],
    [21, "раз в 21 день"],
    [1, "раз в день"],
  ])("Подпись в блоке: каждые %i — «%s»", (days, expected) => {
    expect(formatFrequency("days", days)).toBe(expected);
  });

  test("подпись в блоке для остальных частот", () => {
    expect(
      (["week", "month", "quarter", "year"] as const).map((frequency) =>
        formatFrequency(frequency, null),
      ),
    ).toEqual(["раз в неделю", "раз в месяц", "раз в квартал", "раз в год"]);
  });
});

describe("Дата в карточке: год — только если он не текущий", () => {
  // Midday, so the date is the same in any time zone
  const now = new Date("2026-11-23T12:00:00Z");

  test("в этом году — без года", () => {
    expect(formatDayMonth(new Date("2026-11-15T12:00:00Z"), now)).toBe(
      "15 ноября",
    );
  });

  test("Год в дате: в следующем году — с годом", () => {
    expect(formatDayMonth(new Date("2027-10-24T12:00:00Z"), now)).toBe(
      "24 октября 2027",
    );
  });

  test("Последняя отметка в прошлом году — с годом", () => {
    expect(formatDayMonth(new Date("2025-03-10T12:00:00Z"), now)).toBe(
      "10 марта 2025",
    );
  });
});

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
