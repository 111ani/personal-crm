"use client";

import { useActionState } from "react";
import { Trash2Icon } from "lucide-react";

import { deleteContact, type DeleteContactState } from "@/app/actions";
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

export function DeleteContactDialog({
  contactId,
  name,
}: {
  contactId: string;
  name: string;
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="destructive" />}>
        <Trash2Icon />
        Удалить контакт
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Удалить контакт?</DialogTitle>
          <DialogDescription>
            Контакт «{name}» и все его заметки удалятся навсегда. Отменить это
            будет нельзя.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while the dialog is open, so each opening starts clean */}
        <DeleteContactForm contactId={contactId} />
      </DialogContent>
    </Dialog>
  );
}

function DeleteContactForm({ contactId }: { contactId: string }) {
  // On success the action redirects to the list, so only errors come back
  const [state, formAction, isPending] = useActionState<DeleteContactState>(
    () => deleteContact(contactId),
    { status: "idle" },
  );

  return (
    <form action={formAction} className="grid gap-5">
      {state.status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <DialogFooter>
        <DialogClose
          render={<Button type="button" variant="outline" />}
          disabled={isPending}
        >
          Отмена
        </DialogClose>
        <Button type="submit" variant="destructive" disabled={isPending}>
          {isPending ? "Удаляем…" : "Удалить"}
        </Button>
      </DialogFooter>
    </form>
  );
}
