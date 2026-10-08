"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { contacts, notes } from "@/db/schema";
import {
  contactIdSchema,
  contactSchema,
  noteSchema,
  readContactForm,
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
    }
  | { status: "success"; contactId: string; name: string };

export type NoteFormState =
  | { status: "idle" }
  | { status: "error"; message: string; body: string }
  | { status: "success" };

const SAVE_FAILED = "Не удалось сохранить. Попробуйте ещё раз";

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
  const id = contactIdSchema.safeParse(contactId);
  if (!id.success) {
    return {
      status: "error",
      message: "Контакт не найден",
      fieldErrors: {},
      values,
    };
  }

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
    const [updated] = await db
      .update(contacts)
      .set({ ...parsed.data, updatedAt: sql`now()` })
      .where(eq(contacts.id, id.data))
      .returning({ id: contacts.id, name: contacts.name });

    if (!updated) {
      return {
        status: "error",
        message: "Контакт не найден — возможно, его удалили",
        fieldErrors: {},
        values,
      };
    }

    refreshAllPages();
    return { status: "success", contactId: updated.id, name: updated.name };
  } catch (error) {
    console.error("Failed to update contact", error);
    return { status: "error", message: SAVE_FAILED, fieldErrors: {}, values };
  }
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
