import { z } from "zod";

const emailSchema = z.email();

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = emailSchema.safeParse(value.trim().toLowerCase());
  return email.success ? email.data : null;
}

export function parseOwnerEmail(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const email = normalizeEmail(value);
  if (!email) throw new Error("CRM_OWNER_EMAIL must be a valid email address");
  return email;
}
