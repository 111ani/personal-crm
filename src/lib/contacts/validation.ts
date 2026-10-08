import { z } from "zod";

// Empty optional fields are stored as NULL, not as empty strings
const optionalText = (max: number, tooLongMessage: string) =>
  z
    .string()
    .trim()
    .max(max, tooLongMessage)
    .transform((value) => (value === "" ? null : value));

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Укажите имя")
    .max(200, "Имя слишком длинное — до 200 символов"),
  about: optionalText(500, "Слишком длинно — до 500 символов"),
  howWeMet: optionalText(500, "Слишком длинно — до 500 символов"),
  phone: optionalText(50, "Телефон слишком длинный — до 50 символов").refine(
    (value) => value === null || /^[\d\s()+\-.]{5,}$/.test(value),
    "Телефон может содержать только цифры, пробелы и символы + - ( )",
  ),
  email: optionalText(254, "Почта слишком длинная").refine(
    (value) => value === null || z.email().safeParse(value).success,
    "Проверьте адрес почты — например, name@example.com",
  ),
});

export const noteSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Напишите текст заметки")
    .max(5000, "Заметка слишком длинная — до 5000 символов"),
});

export const contactIdSchema = z.uuid();

export type ContactInput = z.infer<typeof contactSchema>;
export type ContactField = keyof ContactInput;
export type ContactFormValues = Record<ContactField, string>;

export const contactFields: ContactField[] = [
  "name",
  "about",
  "howWeMet",
  "phone",
  "email",
];

export function readContactForm(formData: FormData): ContactFormValues {
  const read = (key: ContactField) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  return {
    name: read("name"),
    about: read("about"),
    howWeMet: read("howWeMet"),
    phone: read("phone"),
    email: read("email"),
  };
}
