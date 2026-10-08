"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { createContact, type ContactFormState } from "@/app/actions";
import { ContactFields } from "@/components/contacts/contact-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ContactFormValues } from "@/lib/contacts/validation";

const emptyValues: ContactFormValues = {
  name: "",
  about: "",
  howWeMet: "",
  phone: "",
  email: "",
};

export function AddContactDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" className="h-10 px-4" />}>
        <PlusIcon />
        Добавить контакт
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Новый контакт</DialogTitle>
          <DialogDescription>
            Обязательно только имя — остальное можно дописать позже.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while the dialog is open, so each opening starts clean */}
        <AddContactForm onCreated={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AddContactForm({ onCreated }: { onCreated: () => void }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    async (prev: ContactFormState, formData: FormData) => {
      const result = await createContact(prev, formData);
      if (result.status === "success") {
        toast.success(`Контакт «${result.name}» добавлен`);
        onCreated();
        // Show the full list with the new contact highlighted
        router.push(`/?new=${result.contactId}`, { scroll: false });
      }
      return result;
    },
    { status: "idle" },
  );

  const values = state.status === "error" ? state.values : emptyValues;
  const errors = state.status === "error" ? state.fieldErrors : {};
  const formError =
    state.status === "error" && Object.keys(state.fieldErrors).length === 0
      ? state.message
      : null;

  return (
    <form action={formAction} noValidate className="grid gap-4">
      <ContactFields
        idPrefix="new-contact"
        values={values}
        errors={errors}
        disabled={isPending}
        autoFocus
      />
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          Отмена
        </DialogClose>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Сохраняем…" : "Добавить"}
        </Button>
      </DialogFooter>
    </form>
  );
}
