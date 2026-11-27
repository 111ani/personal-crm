"use client";

import { useActionState } from "react";
import { toast } from "sonner";

import {
  updateContact,
  type ContactFormState,
  type GroupSummary,
} from "@/app/actions";
import { CheckInToggle } from "@/components/contacts/check-in-toggle";
import { ContactBirthDateField } from "@/components/contacts/contact-birth-date-field";
import { ContactFields } from "@/components/contacts/contact-fields";
import { ContactGroupsField } from "@/components/contacts/contact-groups-field";
import {
  ContactFrequencyField,
  type DueLine,
} from "@/components/contacts/contact-frequency-field";
import { Button } from "@/components/ui/button";
import type {
  ContactBirthDateValues,
  ContactFormValues,
  ContactFrequencyValues,
} from "@/lib/contacts/validation";

export function EditContactForm({
  contactId,
  initialValues,
  initialBirthDate,
  initialFrequency,
  groups,
  initialGroupIds,
  due,
  checkIn,
}: {
  contactId: string;
  initialValues: ContactFormValues;
  initialBirthDate: ContactBirthDateValues;
  initialFrequency: ContactFrequencyValues;
  groups: GroupSummary[];
  initialGroupIds: string[];
  due: DueLine | null;
  // Only when a frequency is saved
  checkIn: { checkedInToday: boolean; lastCheckIn: string | null } | null;
}) {
  const [state, formAction, isPending] = useActionState(
    async (prev: ContactFormState, formData: FormData) => {
      const result = await updateContact(contactId, prev, formData);
      if (result.status === "success") {
        toast.success("Изменения сохранены");
      } else if (result.status === "error") {
        toast.error(result.message);
      }
      return result;
    },
    { status: "idle" },
  );

  // After a failed save keep what the user typed; otherwise show saved data
  const values = state.status === "error" ? state.values : initialValues;
  const frequency =
    state.status === "error" && state.frequency !== undefined
      ? state.frequency
      : initialFrequency;
  const errors = state.status === "error" ? state.fieldErrors : {};
  const birthDate =
    state.status === "error"
      ? (state.birthDate ?? initialBirthDate)
      : initialBirthDate;
  const frequencyError =
    state.status === "error" ? state.frequencyError : undefined;
  const formId = `contact-${contactId}`;

  return (
    <div className="grid gap-5">
      <form id={formId} action={formAction} noValidate className="grid gap-4">
        <ContactFields
          idPrefix={formId}
          values={values}
          errors={errors}
          disabled={isPending}
        />
        <ContactBirthDateField
          idPrefix={`${formId}-birthDate`}
          values={birthDate}
          error={state.status === "error" ? state.birthDateError : undefined}
          disabled={isPending}
        />
        <ContactGroupsField
          groups={groups}
          initialGroupIds={initialGroupIds}
          disabled={isPending}
        />
        <ContactFrequencyField
          // A select applies its default only on mount: remount the field
          // when the values change, so the form reset after saving shows them
          key={`${frequency.frequency}:${frequency.days}`}
          id={`${formId}-contactFrequency`}
          defaultValues={frequency}
          due={due}
          daysError={frequencyError}
          disabled={isPending}
        />
      </form>
      {checkIn && <CheckInToggle contactId={contactId} {...checkIn} />}
      <div>
        {/* Linked by `form`, so controls between the form and the button
            can stay outside the form and never submit it */}
        <Button type="submit" form={formId} disabled={isPending}>
          {isPending ? "Сохраняем…" : "Сохранить изменения"}
        </Button>
      </div>
    </div>
  );
}
