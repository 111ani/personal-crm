"use client";

import { useState } from "react";
import { CalendarIcon, ChevronDownIcon, ClockAlertIcon } from "lucide-react";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { contactFrequencies } from "@/lib/contacts/frequency";
import type { ContactFrequencyValues } from "@/lib/contacts/validation";
import { dayForms, formatFrequencyOption, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The due line under the field, already formatted on the server */
export type DueLine = { label: string; isDue: boolean };

export function ContactFrequencyField({
  id,
  defaultValues,
  due,
  daysError,
  disabled,
}: {
  id: string;
  // Read on mount only: give the field a new `key` to show other values
  defaultValues: ContactFrequencyValues;
  // For the saved frequency, not the one chosen but not saved yet
  due: DueLine | null;
  daysError?: string;
  disabled?: boolean;
}) {
  // The fields stay uncontrolled, so the form reset after saving keeps them;
  // these copies only decide what to show next to them
  const [frequency, setFrequency] = useState(defaultValues.frequency);
  const [days, setDays] = useState(defaultValues.days);
  const dueId = `${id}-due`;
  const daysId = `${id}-days`;
  const daysErrorId = `${daysId}-error`;
  const showDays = frequency === "days";
  const showDaysError = showDays && daysError !== undefined;

  return (
    <Field>
      <FieldLabel htmlFor={id}>Как часто общаться</FieldLabel>
      {/* "Days" reads as one phrase: [Каждые ▾] [3] дня */}
      <div className="flex items-center gap-3">
        {/* A native list: on phones it opens the system picker */}
        <div className={cn("relative", showDays ? "w-36 shrink-0" : "w-full")}>
          <select
            id={id}
            name="contactFrequency"
            defaultValue={defaultValues.frequency}
            onChange={(event) => setFrequency(event.target.value)}
            disabled={disabled}
            aria-describedby={due ? dueId : undefined}
            className="h-11 w-full min-w-0 appearance-none rounded-full border border-input bg-transparent pr-11 pl-4 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-50"
          >
            <option value="">Не задано</option>
            {contactFrequencies.map((option) => (
              <option key={option} value={option}>
                {/* Once chosen, the number box stands in for "… дней" */}
                {option === "days" && showDays
                  ? "Каждые"
                  : formatFrequencyOption(option)}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        {/* Hidden, not removed, for other frequencies: the typed number stays
            if "days" is chosen again; the server ignores it otherwise */}
        <div className={cn("flex items-center gap-3", !showDays && "hidden")}>
          <Input
            id={daysId}
            name="contactFrequencyDays"
            defaultValue={defaultValues.days}
            onChange={(event) => setDays(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            maxLength={3}
            aria-label="Число дней"
            aria-invalid={showDaysError ? true : undefined}
            aria-describedby={showDaysError ? daysErrorId : undefined}
            disabled={disabled}
            className="w-20 text-center"
          />
          <span aria-hidden>{pluralize(Number(days) || 0, dayForms)}</span>
        </div>
      </div>
      {showDaysError && <FieldError id={daysErrorId}>{daysError}</FieldError>}
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
