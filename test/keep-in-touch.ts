// What the card and the home page show for "Пора связаться", built from the
// same queries and formatting the pages use

import { getContactWithNotes, listDueContacts } from "@/lib/contacts/queries";
import { formatDayMonth, formatFrequency, formatOverdue } from "@/lib/format";

import { dayFromToday } from "./factories";

export const idle = { status: "idle" } as const;

/** The data the card's form sends; "" frequency is "Не задано" */
export function cardForm(
  fields: {
    name?: string;
    about?: string;
    phone?: string;
    frequency?: string;
    days?: string;
  } = {},
) {
  const formData = new FormData();
  formData.set("name", fields.name ?? "Анна");
  formData.set("about", fields.about ?? "");
  formData.set("howWeMet", "");
  formData.set("phone", fields.phone ?? "");
  formData.set("email", "");
  formData.set("contactFrequency", fields.frequency ?? "");
  formData.set("contactFrequencyDays", fields.days ?? "");
  return formData;
}

/** The "Как часто общаться" part of a contact's card, as after a reload */
export async function openCard(contactId: string) {
  const data = await getContactWithNotes(contactId);
  if (!data) {
    throw new Error(`Contact ${contactId} not found`);
  }
  const { contact, notes, due } = data;
  return {
    // The chosen option: "" is "Не задано"
    frequency: contact.contactFrequency ?? "",
    days: contact.contactFrequencyDays,
    // The line under the field; null when there is none
    dueLine:
      due &&
      (due.isDue
        ? `Пора связаться — ${formatOverdue(due.overdueDays)}`
        : `Связаться до ${formatDayMonth(due.dueAt, due.now)}`),
    dueAt: due?.dueAt ?? null,
    // The "Связались сегодня" tick; null when there is none
    checkIn: due && {
      checked: due.checkedInToday,
      lastCheckIn:
        !due.checkedInToday && due.lastCheckInAt
          ? `Последняя отметка — ${formatDayMonth(due.lastCheckInAt, due.now)}`
          : null,
    },
    noteCount: notes.length,
  };
}

/** "Пора связаться" on the home page; `title` is null when there is no block */
export async function openDueBlock() {
  const contacts = await listDueContacts();
  const rows = contacts.map((contact) => ({
    id: contact.id,
    name: contact.name,
    overdue: formatOverdue(contact.overdueDays),
    // The line under the name: "раз в неделю · просрочено на 8 дней"
    caption: `${formatFrequency(contact.frequency, contact.frequencyDays)} · ${formatOverdue(contact.overdueDays)}`,
  }));
  return {
    title: rows.length > 0 ? `Пора связаться · ${rows.length}` : null,
    ids: rows.map((row) => row.id),
    // "Анна: раз в неделю · просрочено на 8 дней", top to bottom
    lines: rows.map((row) => `${row.name}: ${row.caption}`),
    rows,
  };
}

/** The line under the field when the due date is `interval` from today */
export async function dueLineIn(interval: string) {
  const day = await dayFromToday(interval);
  return `Связаться до ${formatDayMonth(day, new Date())}`;
}
