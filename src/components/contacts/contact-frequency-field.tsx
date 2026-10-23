"use client";

import { CalendarIcon, ChevronDownIcon, ClockAlertIcon } from "lucide-react";

import { Field, FieldLabel } from "@/components/ui/field";
import { contactFrequencies } from "@/lib/contacts/frequency";
import { formatFrequencyOption } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The due line under the field, already formatted on the server */
export type DueLine = { label: string; isDue: boolean };

export function ContactFrequencyField({
  id,
  defaultValue,
  due,
  disabled,
}: {
  id: string;
  defaultValue: string;
  // For the saved frequency, not the one chosen but not saved yet
  due: DueLine | null;
  disabled?: boolean;
}) {
  const dueId = `${id}-due`;

  return (
    <Field>
      <FieldLabel htmlFor={id}>Как часто общаться</FieldLabel>
      {/* A native list: on phones it opens the system picker */}
      <div className="relative">
        <select
          // React applies a select's defaultValue only on mount: remount it
          // when the value changes, so the form reset after saving shows it
          key={defaultValue}
          id={id}
          name="contactFrequency"
          defaultValue={defaultValue}
          disabled={disabled}
          aria-describedby={due ? dueId : undefined}
          className="h-11 w-full min-w-0 appearance-none rounded-full border border-input bg-transparent pr-11 pl-4 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-50"
        >
          <option value="">Не задано</option>
          {contactFrequencies.map((frequency) => (
            <option key={frequency} value={frequency}>
              {formatFrequencyOption(frequency)}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      {due && (
        <p
          id={dueId}
          className={cn(
            "flex items-start gap-2 text-sm",
            due.isDue ? "font-medium text-brand" : "text-muted-foreground",
          )}
        >
          {due.isDue ? (
            <ClockAlertIcon className="mt-0.5 size-4 shrink-0" />
          ) : (
            <CalendarIcon className="mt-0.5 size-4 shrink-0" />
          )}
          {due.label}
        </p>
      )}
    </Field>
  );
}
