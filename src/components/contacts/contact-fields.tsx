"use client";

import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type {
  ContactField,
  ContactFormValues,
} from "@/lib/contacts/validation";

type FieldConfig = {
  name: ContactField;
  label: string;
  placeholder: string;
  type?: "text" | "tel" | "email";
  autoComplete?: string;
};

const fields: FieldConfig[] = [
  {
    name: "name",
    label: "Имя",
    placeholder: "Например, Анна Смирнова",
    autoComplete: "off",
  },
  {
    name: "about",
    label: "Кто это",
    placeholder: "Дизайнер, сосед по даче, тренер по теннису…",
    autoComplete: "off",
  },
  {
    name: "howWeMet",
    label: "Откуда знакомы",
    placeholder: "Учились вместе, познакомились на конференции…",
    autoComplete: "off",
  },
  {
    name: "phone",
    label: "Телефон",
    placeholder: "+7 900 123-45-67",
    type: "tel",
    autoComplete: "off",
  },
  {
    name: "email",
    label: "Почта",
    placeholder: "name@example.com",
    type: "email",
    autoComplete: "off",
  },
];

export function ContactFields({
  idPrefix,
  values,
  errors,
  disabled,
  autoFocus,
}: {
  idPrefix: string;
  values: ContactFormValues;
  errors: Partial<Record<ContactField, string>>;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <FieldGroup className="gap-4">
      {fields.map((field) => {
        const id = `${idPrefix}-${field.name}`;
        const error = errors[field.name];
        return (
          <Field key={field.name} data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor={id}>
              {field.label}
              {field.name === "name" && (
                <span className="text-destructive" aria-hidden>
                  *
                </span>
              )}
            </FieldLabel>
            <Input
              id={id}
              name={field.name}
              type={field.type ?? "text"}
              defaultValue={values[field.name]}
              placeholder={field.placeholder}
              autoComplete={field.autoComplete}
              autoFocus={autoFocus && field.name === "name"}
              aria-invalid={error ? true : undefined}
              aria-required={field.name === "name" ? true : undefined}
              disabled={disabled}
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>
        );
      })}
    </FieldGroup>
  );
}
