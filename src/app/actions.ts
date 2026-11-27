"use server";

import { and, eq, exists, gte, inArray, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";

import { getDb } from "@/db";
import {
  contactCheckIns,
  contactGroups,
  contacts,
  groups,
  notes,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { startOfToday } from "@/lib/contacts/queries";
import {
  checkInIdSchema,
  contactBirthDateSchema,
  contactFrequencySchema,
  contactIdSchema,
  contactSchema,
  groupIdsSchema,
  noteSchema,
  readContactBirthDate,
  readContactForm,
  readContactFrequency,
  readGroupIds,
  type ContactBirthDateValues,
  type ContactField,
  type ContactFormValues,
  type ContactFrequencyValues,
} from "@/lib/contacts/validation";
import {
  groupExistsMessage,
  groupIdSchema,
  groupNameSchema,
} from "@/lib/groups/validation";

export type GroupSummary = { id: string; name: string };

export type CreateGroupResult =
  | { status: "created"; group: GroupSummary }
  // The name is taken (letter case aside): nothing was created, `group` is
  // the one that already exists
  | { status: "exists"; group: GroupSummary; message: string }
  | { status: "error"; message: string };

export type GroupResult =
  { status: "success" } | { status: "error"; message: string };

export type ContactFormState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors: Partial<Record<ContactField, string>>;
      values: ContactFormValues;
      // The ticked groups, so a failed save does not untick them
      groupIds: string[];
      // Only the card's form has the frequency field
      frequency?: ContactFrequencyValues;
      // For the number of days under it
      frequencyError?: string;
      birthDate?: ContactBirthDateValues;
      birthDateError?: string;
    }
  | { status: "success"; contactId: string; name: string };

export type NoteFormState =
  | { status: "idle" }
  | { status: "error"; message: string; body: string }
  | { status: "success" };

export type DeleteContactState =
  { status: "idle" } | { status: "error"; message: string };

export type CheckInResult =
  | { status: "success"; checkInId: string }
  | { status: "error"; message: string };

export type CheckInChangeResult =
  { status: "success" } | { status: "error"; message: string };

const SAVE_FAILED = "Не удалось сохранить. Попробуйте ещё раз";
const CHECK_IN_FAILED = "Не удалось отметить. Попробуйте ещё раз";
const SIGN_IN_REQUIRED = "Войдите в CRM, чтобы продолжить";
const CONTACT_NOT_FOUND = "Контакт не найден";
const GROUP_NOT_FOUND = "Группа не найдена";
const UNAVAILABLE_GROUP =
  "Одна из групп недоступна. Обнови страницу и выбери группы снова";

class UnavailableGroupError extends Error {}

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

// Keep the selected groups alive for the full contact transaction.
async function replaceContactGroups(
  tx: Pick<ReturnType<typeof getDb>, "delete" | "insert" | "select">,
  ownerId: string,
  contactId: string,
  groupIds: string[],
) {
  const selected =
    groupIds.length === 0
      ? []
      : await tx
          .select({ groupId: groups.id })
          .from(groups)
          .where(and(eq(groups.ownerId, ownerId), inArray(groups.id, groupIds)))
          .orderBy(groups.id)
          .for("key share");
  if (selected.length !== groupIds.length) throw new UnavailableGroupError();

  await tx.delete(contactGroups).where(eq(contactGroups.contactId, contactId));
  if (selected.length > 0) {
    await tx
      .insert(contactGroups)
      .values(selected.map(({ groupId }) => ({ contactId, groupId })));
  }
}

export async function createContact(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const values = readContactForm(formData);
  const groupIds = readGroupIds(formData);
  const user = await getCurrentUser();
  if (!user)
    return {
      status: "error",
      message: SIGN_IN_REQUIRED,
      fieldErrors: {},
      values,
      groupIds,
    };
  const parsed = contactSchema.safeParse(values);
  const parsedGroupIds = groupIdsSchema.safeParse(groupIds);
  if (!parsed.success || !parsedGroupIds.success) {
    return {
      status: "error",
      message: "Проверьте поля формы",
      fieldErrors: parsed.success
        ? {}
        : firstErrors<ContactField>(parsed.error),
      values,
      groupIds,
    };
  }

  try {
    // The contact and its groups are saved together: all or nothing
    const created = await getDb().transaction(async (tx) => {
      const [row] = await tx
        .insert(contacts)
        .values({ ...parsed.data, ownerId: user.id })
        .returning({ id: contacts.id, name: contacts.name });
      await replaceContactGroups(tx, user.id, row.id, parsedGroupIds.data);
      return row;
    });

    refreshAllPages();
    return { status: "success", contactId: created.id, name: created.name };
  } catch (error) {
    if (!(error instanceof UnavailableGroupError))
      console.error("Failed to create contact", error);
    return {
      status: "error",
      message:
        error instanceof UnavailableGroupError
          ? UNAVAILABLE_GROUP
          : SAVE_FAILED,
      fieldErrors: {},
      values,
      groupIds,
    };
  }
}

export async function updateContact(
  contactId: string,
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const values = readContactForm(formData);
  const frequencyValues = readContactFrequency(formData);
  const birthDateValues = readContactBirthDate(formData);
  const groupIds = readGroupIds(formData);
  // Keep what the user typed and chose, so a failed save loses nothing
  const failure = (
    message: string,
    fieldErrors: Partial<Record<ContactField, string>> = {},
    frequencyError?: string,
    birthDateError?: string,
  ): ContactFormState => ({
    status: "error",
    message,
    fieldErrors,
    values,
    groupIds,
    frequency: frequencyValues,
    frequencyError,
    ...(birthDateValues && { birthDate: birthDateValues, birthDateError }),
  });

  const user = await getCurrentUser();
  if (!user) return failure(SIGN_IN_REQUIRED);

  const id = contactIdSchema.safeParse(contactId);
  if (!id.success) {
    return failure("Контакт не найден");
  }

  const parsed = contactSchema.safeParse(values);
  const frequency = contactFrequencySchema.safeParse(frequencyValues);
  const birthDate = contactBirthDateSchema.safeParse(birthDateValues);
  const parsedGroupIds = groupIdsSchema.safeParse(groupIds);
  const frequencyIssue = frequency.error?.issues[0];
  if (frequencyIssue && frequencyIssue.path[0] !== "days") {
    // Only a tampered form can send a value that is not in the list
    return failure(frequencyIssue.message);
  }
  if (!parsedGroupIds.success) {
    // Also only a tampered form: the field sends ids of existing groups
    return failure("Проверьте поля формы");
  }
  if (!parsed.success || !frequency.success || !birthDate.success) {
    return failure(
      "Проверьте поля формы",
      parsed.success ? {} : firstErrors<ContactField>(parsed.error),
      frequencyIssue?.message,
      birthDate.error?.issues[0]?.message,
    );
  }
  const { frequency: contactFrequency, days: contactFrequencyDays } =
    frequency.data;

  try {
    // The contact and its groups are saved together: all or nothing
    const updated = await getDb().transaction(async (tx) => {
      const [row] = await tx
        .update(contacts)
        .set({
          ...parsed.data,
          ...birthDate.data,
          contactFrequency,
          contactFrequencyDays,
          // A new frequency (or a new number of days) starts counting now; the
          // same one keeps its moment, so editing only the phone does not move
          // the due date
          contactFrequencySetAt:
            contactFrequency === null
              ? null
              : sql`case when ${contacts.contactFrequency} = ${contactFrequency} and ${contacts.contactFrequencyDays} is not distinct from ${contactFrequencyDays} then ${contacts.contactFrequencySetAt} else now() end`,
          updatedAt: sql`now()`,
        })
        .where(and(eq(contacts.id, id.data), eq(contacts.ownerId, user.id)))
        .returning({ id: contacts.id, name: contacts.name });
      if (row) {
        await replaceContactGroups(tx, user.id, row.id, parsedGroupIds.data);
      }
      return row;
    });

    if (!updated) {
      return failure("Контакт не найден — возможно, его удалили");
    }

    refreshAllPages();
    return { status: "success", contactId: updated.id, name: updated.name };
  } catch (error) {
    if (error instanceof UnavailableGroupError)
      return failure(UNAVAILABLE_GROUP);
    console.error("Failed to update contact", error);
    return failure(SAVE_FAILED);
  }
}

export async function deleteContact(
  contactId: string,
): Promise<DeleteContactState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: SIGN_IN_REQUIRED };
  const id = contactIdSchema.safeParse(contactId);
  if (!id.success) {
    return { status: "error", message: "Контакт не найден" };
  }

  try {
    // Notes and check-ins are removed by their foreign keys.
    const [deleted] = await getDb()
      .delete(contacts)
      .where(and(eq(contacts.id, id.data), eq(contacts.ownerId, user.id)))
      .returning({ id: contacts.id });
    if (!deleted) return { status: "error", message: CONTACT_NOT_FOUND };
  } catch (error) {
    console.error("Failed to delete contact", error);
    return {
      status: "error",
      message: "Не удалось удалить. Попробуйте ещё раз",
    };
  }

  refreshAllPages();
  // Redirect from the server: otherwise the refreshed card would flash
  // "not found" before the client navigates. Replace, so Back does not
  // return to the deleted card. Must stay outside try/catch: it throws
  redirect("/", RedirectType.replace);
}

// The group whose name equals the given one, letter case aside (the same rule
// as the unique index on lower(name)); `exceptId` skips the group itself
async function findGroupByName(
  ownerId: string,
  name: string,
  exceptId?: string,
) {
  const [found] = await getDb()
    .select({ id: groups.id, name: groups.name })
    .from(groups)
    .where(
      and(
        eq(groups.ownerId, ownerId),
        sql`lower(${groups.name}) = lower(${name})`,
        exceptId ? ne(groups.id, exceptId) : undefined,
      ),
    )
    .limit(1);
  return found ?? null;
}

// 23505 is "unique violation"; drizzle wraps the database error in `cause`
function isUniqueViolation(error: unknown) {
  const code =
    (error as { code?: string }).code ??
    (error as { cause?: { code?: string } }).cause?.code;
  return code === "23505";
}

/**
 * Creates a group. A taken name (letter case aside) creates nothing and
 * returns the existing group: the page shows it as an error, the "Группы"
 * field just ticks that group
 */
export async function createGroup(name: string): Promise<CreateGroupResult> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: SIGN_IN_REQUIRED };
  const parsed = groupNameSchema.safeParse(name);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }

  try {
    const [created] = await getDb()
      .insert(groups)
      .values({ name: parsed.data, ownerId: user.id })
      .onConflictDoNothing()
      .returning({ id: groups.id, name: groups.name });
    if (created) {
      refreshAllPages();
      return { status: "created", group: created };
    }

    const existing = await findGroupByName(user.id, parsed.data);
    if (existing) {
      return {
        status: "exists",
        group: existing,
        message: groupExistsMessage(existing.name),
      };
    }
    return { status: "error", message: SAVE_FAILED };
  } catch (error) {
    console.error("Failed to create group", error);
    return { status: "error", message: SAVE_FAILED };
  }
}

export async function renameGroup(
  groupId: string,
  name: string,
): Promise<GroupResult> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: SIGN_IN_REQUIRED };
  const id = groupIdSchema.safeParse(groupId);
  if (!id.success) {
    return { status: "error", message: "Группа не найдена" };
  }
  const parsed = groupNameSchema.safeParse(name);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }

  try {
    const [updated] = await getDb()
      .update(groups)
      .set({ name: parsed.data })
      .where(and(eq(groups.id, id.data), eq(groups.ownerId, user.id)))
      .returning({ id: groups.id });
    if (!updated) {
      return {
        status: "error",
        message: "Группа не найдена — возможно, её удалили",
      };
    }

    refreshAllPages();
    return { status: "success" };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const taken = await findGroupByName(user.id, parsed.data, id.data);
      if (taken) {
        return { status: "error", message: groupExistsMessage(taken.name) };
      }
    }
    console.error("Failed to rename group", error);
    return { status: "error", message: SAVE_FAILED };
  }
}

export async function deleteGroup(groupId: string): Promise<GroupResult> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: SIGN_IN_REQUIRED };
  const id = groupIdSchema.safeParse(groupId);
  if (!id.success) {
    return { status: "error", message: GROUP_NOT_FOUND };
  }

  try {
    // The foreign key removes memberships while keeping the contacts.
    const [deleted] = await getDb()
      .delete(groups)
      .where(and(eq(groups.id, id.data), eq(groups.ownerId, user.id)))
      .returning({ id: groups.id });
    if (!deleted) return { status: "error", message: GROUP_NOT_FOUND };
  } catch (error) {
    console.error("Failed to delete group", error);
    return {
      status: "error",
      message: "Не удалось удалить. Попробуйте ещё раз",
    };
  }

  refreshAllPages();
  return { status: "success" };
}

export async function addNote(
  contactId: string,
  _prev: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const rawBody = formData.get("body");
  const body = typeof rawBody === "string" ? rawBody : "";
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: SIGN_IN_REQUIRED, body };

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
    const inserted = await getDb().transaction(async (tx) => {
      const [contact] = await tx
        .update(contacts)
        .set({ updatedAt: sql`now()` })
        .where(and(eq(contacts.id, id.data), eq(contacts.ownerId, user.id)))
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
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: SIGN_IN_REQUIRED };
  const id = contactIdSchema.safeParse(contactId);
  if (!id.success) {
    return { status: "error", message: "Контакт не найден" };
  }

  try {
    const [created] = await getDb()
      .insert(contactCheckIns)
      .select((qb) =>
        qb
          .select({
            id: sql<string>`gen_random_uuid()`.as("id"),
            contactId: contacts.id,
            createdAt: sql<Date>`now()`.as("created_at"),
          })
          .from(contacts)
          .where(and(eq(contacts.id, id.data), eq(contacts.ownerId, user.id))),
      )
      .returning({ id: contactCheckIns.id });
    if (!created) return { status: "error", message: CONTACT_NOT_FOUND };

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
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: SIGN_IN_REQUIRED };
  const id = checkInIdSchema.safeParse(checkInId);
  if (!id.success) {
    return { status: "error", message: SAVE_FAILED };
  }

  try {
    const db = getDb();
    const [deleted] = await db
      .delete(contactCheckIns)
      .where(
        and(
          eq(contactCheckIns.id, id.data),
          exists(
            db
              .select({ id: contacts.id })
              .from(contacts)
              .where(
                and(
                  eq(contacts.id, contactCheckIns.contactId),
                  eq(contacts.ownerId, user.id),
                ),
              ),
          ),
        ),
      )
      .returning({ id: contactCheckIns.id });
    if (!deleted) return { status: "error", message: SAVE_FAILED };
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
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: SIGN_IN_REQUIRED };
  const id = contactIdSchema.safeParse(contactId);
  if (!id.success) {
    return { status: "error", message: "Контакт не найден" };
  }

  try {
    const found = await getDb().transaction(async (tx) => {
      const [contact] = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.id, id.data), eq(contacts.ownerId, user.id)))
        .for("key share");
      if (!contact) return false;
      await tx
        .delete(contactCheckIns)
        .where(
          and(
            eq(contactCheckIns.contactId, contact.id),
            gte(contactCheckIns.createdAt, startOfToday),
          ),
        );
      return true;
    });
    if (!found) return { status: "error", message: CONTACT_NOT_FOUND };
  } catch (error) {
    console.error("Failed to clear today's check-ins", error);
    return { status: "error", message: SAVE_FAILED };
  }

  refreshAllPages();
  return { status: "success" };
}
