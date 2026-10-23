import type { ContactFrequency } from "@/lib/contacts/frequency";

const pluralRules = new Intl.PluralRules("ru-RU");

const numberFormat = new Intl.NumberFormat("ru-RU");

const dateTimeFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dayMonthFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
});

const frequencyLabels: Record<ContactFrequency, string> = {
  week: "раз в неделю",
  month: "раз в месяц",
  quarter: "раз в квартал",
  year: "раз в год",
};

/** Picks the Russian word form for a number: [one, few, many] */
export function pluralize(
  count: number,
  [one, few, many]: [string, string, string],
) {
  switch (pluralRules.select(count)) {
    case "one":
      return one;
    case "few":
      return few;
    default:
      return many;
  }
}

export function formatCount(
  count: number,
  forms: [string, string, string],
) {
  return `${numberFormat.format(count)} ${pluralize(count, forms)}`;
}

export function formatDateTime(date: Date) {
  return dateTimeFormat.format(date);
}

/** "15 ноября"; the year only if it is not the current one: "24 октября 2027" */
export function formatDayMonth(date: Date, now: Date) {
  const dayMonth = dayMonthFormat.format(date);
  return date.getFullYear() === now.getFullYear()
    ? dayMonth
    : `${dayMonth} ${date.getFullYear()}`;
}

/** "раз в месяц" - for the line under a contact's name */
export function formatFrequency(frequency: ContactFrequency) {
  return frequencyLabels[frequency];
}

/** "Раз в месяц" - for the option in the list */
export function formatFrequencyOption(frequency: ContactFrequency) {
  const label = frequencyLabels[frequency];
  return label[0].toUpperCase() + label.slice(1);
}

/**
 * How long a contact is overdue: under a day - "срок сегодня", then days
 * up to 14, full weeks up to 60 days, full 30-day months up to a year,
 * then full years
 */
export function formatOverdue(days: number) {
  const overdueBy = (count: number, forms: [string, string, string]) =>
    `просрочено на ${count} ${pluralize(count, forms)}`;

  if (days < 1) {
    return "срок сегодня";
  }
  if (days < 14) {
    return overdueBy(days, ["день", "дня", "дней"]);
  }
  if (days < 60) {
    return overdueBy(Math.floor(days / 7), ["неделю", "недели", "недель"]);
  }
  if (days < 365) {
    return overdueBy(Math.floor(days / 30), ["месяц", "месяца", "месяцев"]);
  }
  return overdueBy(Math.floor(days / 365), ["год", "года", "лет"]);
}

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]);
  return letters.join("").toUpperCase() || "?";
}
