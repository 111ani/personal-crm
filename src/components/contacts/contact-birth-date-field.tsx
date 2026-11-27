import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ContactBirthDateValues } from "@/lib/contacts/validation";

const parts = [
  { name: "birthDay", label: "День", placeholder: "ДД", maxLength: 2 },
  { name: "birthMonth", label: "Месяц", placeholder: "ММ", maxLength: 2 },
  { name: "birthYear", label: "Год", placeholder: "ГГГГ", maxLength: 4 },
] as const;

export function ContactBirthDateField({
  idPrefix,
  values,
  error,
  disabled,
}: {
  idPrefix: string;
  values: ContactBirthDateValues;
  error?: string;
  disabled: boolean;
}) {
  const errorId = error ? `${idPrefix}-error` : undefined;
  const descriptionId = `${idPrefix}-description`;
  return (
    <FieldSet
      disabled={disabled}
      className="gap-2"
      aria-describedby={descriptionId}
    >
      <FieldLegend variant="label">Дата рождения</FieldLegend>
      <div className="grid grid-cols-3 items-end gap-2">
        {parts.map(({ name, label, placeholder, maxLength }) => {
          const id = `${idPrefix}-${name}`;
          return (
            <Field key={name} data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor={id}>{label}</FieldLabel>
              <Input
                id={id}
                name={name}
                inputMode="numeric"
                maxLength={maxLength}
                placeholder={placeholder}
                defaultValue={values[name]}
                aria-invalid={error ? true : undefined}
                aria-describedby={errorId}
              />
            </Field>
          );
        })}
      </div>
      <FieldDescription id={descriptionId}>
        Год можно не указывать
      </FieldDescription>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </FieldSet>
  );
}
