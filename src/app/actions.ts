"use server";

import { and, eq, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { contactCheckIns, contacts, notes } from "@/db/schema";
import { startOfToday } from "@/lib/contacts/queries";
import {
  checkInIdSchema,
  contactFrequencySchema,
  contactIdSchema,
  contactSchema,
  noteSchema,
  readContactForm,
  readContactFrequency,
  type ContactField,
  type ContactFormValues,
} from "@/lib/contacts/validation";

export type ContactFormState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors: Partial<Record<ContactField, string>>;
      values: ContactFormValues;
      // Only the card's form has the frequency field
      frequency?: string;
    }
  | { status: "success"; contactId: string; name: string };

export type NoteFormState =
  | { status: "idle" }
  | { status: "error"; message: string; body: string }
  | { status: "success" };

export type DeleteContactState =
  | { status: "idle" }
  | { status: "error"; message: string };

export type CheckInResult =
  | { status: "success"; checkInId: string }
  | { status: "error"; message: string };

export type CheckInChangeResult =
  | { status: "success" }
  | { status: "error"; message: string };

const SAVE_FAILED = "Не удалось сохранить. Попробуйте ещё раз";
const CHECK_IN_FAILED = "Не удалось отметить. Попробуйте ещё раз";

function firstErrors<T extends string>(error: z.ZodError) {
  const fieldErrors: Partial<Record<T, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as T | undefined;
    if (field && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }
  return fieldErrors;
}

// Purges cached pages, including the browser router cache, so every
// page shows fresh data after a change
function refreshAllPages() {
  revalidatePath("/", "layout");
}

export async function createContact(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const values = readContactForm(formData);
  const parsed = contactSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Проверьте поля формы",
      fieldErrors: firstErrors<ContactField>(parsed.error),
      values,
    };
  }

  try {
    const [created] = await db
      .insert(contacts)
      .values(parsed.data)
      .returning({ id: contacts.id, name: contacts.name });

    refreshAllPages();
    return { status: "success", contactId: created.id, name: created.name };
  } catch (error) {
    console.error("Failed to create contact", error);
    return { status: "error", message: SAVE_FAILED, fieldErrors: {}, values };
  }
}

export async function updateContact(
  contactId: string,
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const values = readContactForm(formData);
  const frequencyValue = readContactFrequency(formData);
  // Keep what the user typed and chose, so a failed save loses nothing
  const failure = (
    message: string,
    fieldErrors: Partial<Record<ContactField, string>> = {},
  ): ContactFormState => ({
    status: "error",
    message,
    fieldErrors,
    values,
    frequency: frequencyValue,
  });

  const id = contactIdSchema.safeParse(contactId);
  if (!id.success) {
    return failure("Контакт не найден");
  }

  const parsed = contactSchema.safeParse(values);
  if (!parsed.success) {
    return failure(
      "Проверьте поля формы",
      firstErrors<ContactField>(parsed.error),
    );
  }

  const frequency = contactFrequencySchema.safeParse(frequencyValue);
  if (!frequency.success) {
    // Only a tampered form can send a value that is not in the list
    return failure(frequency.error.issues[0]?.message ?? SAVE_FAILED);
  }

  try {
    const [updated] = await db
      .update(contacts)
      .set({
        ...parsed.data,
        contactFrequency: frequency.data,
        // A new frequency starts counting now; the same one keeps its moment,
        // so editing only the phone does not move the due date
        contactFrequencySetAt:
          frequency.data === null
            ? null
            : sql`case when ${contacts.contactFrequency} = ${frequency.data} then ${contacts.contactFrequencySetAt} else now() end`,
        updatedAt: sql`now()`,
      })
      .where(eq(contacts.id, id.data))
      .returning({ id: contacts.id, name: contacts.name });

    if (!updated) {
      return failure("Контакт не найден — возможно, его удалили");
    }

    refreshAllPages();
    return { status: "success", contactId: updated.id, name: updated.name };
  } catch (error) {
    console.error("Failed to update contact", error);
    return failure(SAVE_FAILED);
  }
}

export async function deleteContact(
  contactId: string,
): Promise<DeleteContactState> {
  const id = contactIdSchema.safeParse(contactId);
  if (!id.success) {
    return { status: "error", message: "Контакт не найден" };
  }

  try {
    // Notes go too: notes.contact_id is ON DELETE CASCADE. A contact that
    // is already gone is not an error - the user gets what they wanted
    await db.delete(contacts).where(eq(contacts.id, id.data));
  } catch (error) {
    console.error("Failed to delete contact", error);
    return { status: "error", message: "Не удалось удалить. Попробуйте ещё раз" };
  }

  refreshAllPages();
  // Redirect from the server: otherwise the refreshed card would flash
  // "not found" before the client navigates. Replace, so Back does not
  // return to the deleted card. Must stay outside try/catch: it throws
  redirect("/", RedirectType.replace);
}

export async function addNote(
  contactId: string,
  _prev: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const rawBody = formData.get("body");
  const body = typeof rawBody === "string" ? rawBody : "";

  const id = contactIdSchema.safeParse(contactId);
  if (!id.success) {
    return { status: "error", message: "Контакт не найден", body };
  }

  const parsed = noteSchema.safeParse({ body });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? SAVE_FAILED,
      body,
    };
  }

  try {
    const inserted = await db.transaction(async (tx) => {
      const [contact] = await tx
        .update(contacts)
        .set({ updatedAt: sql`now()` })
        .where(eq(contacts.id, id.data))
        .returning({ id: contacts.id });
      if (!contact) {
        return false;
      }
      await tx
        .insert(notes)
        .values({ contactId: contact.id, body: parsed.data.body });
      return true;
    });

    if (!inserted) {
      return {
        status: "error",
        message: "Контакт не найден — возможно, его удалили",
        body,
      };
    }

    refreshAllPages();
    return { status: "success" };
  } catch (error) {
    console.error("Failed to add note", error);
    return { status: "error", message: SAVE_FAILED, body };
  }
}

/** "Связались": records contact now. The id lets the user undo exactly it */
export async function checkIn(contactId: string): Promise<CheckInResult> {
  const id = contactIdSchema.safeParse(contactId);
  if (!id.success) {
    return { status: "error", message: "Контакт не найден" };
  }

  try {
    const [created] = await db
      .insert(contactCheckIns)
      .values({ contactId: id.data })
      .returning({ id: contactCheckIns.id });

    refreshAllPages();
    return { status: "success", checkInId: created.id };
  } catch (error) {
    console.error("Failed to check in", error);
    return { status: "error", message: CHECK_IN_FAILED };
  }
}

/** "Отменить" in the message after a check-in from the home block */
export async function undoCheckIn(
  checkInId: string,
): Promise<CheckInChangeResult> {
  const id = checkInIdSchema.safeParse(checkInId);
  if (!id.success) {
    return { status: "error", message: SAVE_FAILED };
  }

  try {
    // A check-in that is already gone is not an error
    await db.delete(contactCheckIns).where(eq(contactCheckIns.id, id.data));
  } catch (error) {
    console.error("Failed to undo check-in", error);
    return { status: "error", message: SAVE_FAILED };
  }

  refreshAllPages();
  return { status: "success" };
}

/** Unticking "Связались сегодня" in the card: today's check-ins go */
export async function clearTodayCheckIns(
  contactId: string,
): Promise<CheckInChangeResult> {
  const id = contactIdSchema.safeParse(contactId);
  if (!id.success) {
    return { status: "error", message: "Контакт не найден" };
  }

  try {
    await db
      .delete(contactCheckIns)
      .where(
        and(
          eq(contactCheckIns.contactId, id.data),
          gte(contactCheckIns.createdAt, startOfToday),
        ),
      );
  } catch (error) {
    console.error("Failed to clear today's check-ins", error);
    return { status: "error", message: SAVE_FAILED };
  }

  refreshAllPages();
  return { status: "success" };
}
