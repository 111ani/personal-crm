const pluralRules = new Intl.PluralRules("ru-RU");

const numberFormat = new Intl.NumberFormat("ru-RU");

const dateTimeFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

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

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]);
  return letters.join("").toUpperCase() || "?";
}
