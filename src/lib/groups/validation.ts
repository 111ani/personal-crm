import { z } from "zod";

// Trimmed first, so "  Теннис  " is stored as "Теннис" and "   " counts as empty
export const groupNameSchema = z
  .string()
  .trim()
  .min(1, "Укажите название группы")
  .max(50, "Название слишком длинное — до 50 символов");

export const groupIdSchema = z.uuid();

export function groupExistsMessage(name: string) {
  return `Группа «${name}» уже есть`;
}
