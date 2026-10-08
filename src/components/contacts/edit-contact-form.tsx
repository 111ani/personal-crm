"use client";

import { useActionState } from "react";
import { toast } from "sonner";

import { updateContact, type ContactFormState } from "@/app/actions";
import { ContactFields } from "@/components/contacts/contact-fields";
import { Button } from "@/components/ui/button";
import type { ContactFormValues } from "@/lib/contacts/validation";

export function EditContactForm({
  contactId,
  initialValues,
}: {
  contactId: string;
  initialValues: ContactFormValues;
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
  const errors = state.status === "error" ? state.fieldErrors : {};

  return (
    <form action={formAction} noValidate className="grid gap-5">
      <ContactFields
        idPrefix={`contact-${contactId}`}
        values={values}
        errors={errors}
        disabled={isPending}
      />
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Сохраняем…" : "Сохранить изменения"}
        </Button>
      </div>
    </form>
  );
}
