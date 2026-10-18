"use client";

import { useActionState } from "react";
import { toast } from "sonner";

import { addNote, type NoteFormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

export function AddNoteForm({ contactId }: { contactId: string }) {
  const [state, formAction, isPending] = useActionState(
    async (prev: NoteFormState, formData: FormData) => {
      const result = await addNote(contactId, prev, formData);
      if (result.status === "success") {
        toast.success("Заметка добавлена");
      }
      return result;
    },
    { status: "idle" },
  );

  const error = state.status === "error" ? state.message : null;
  const textareaId = `note-${contactId}`;

  return (
    <form action={formAction} noValidate className="grid gap-3">
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor={textareaId} className="sr-only">
          Новая заметка
        </FieldLabel>
        <Textarea
          id={textareaId}
          name="body"
          // Keep the text if saving failed; after success the form resets
          defaultValue={state.status === "error" ? state.body : ""}
          placeholder="О чём поговорили, о чём договорились, что важно не забыть…"
          className="min-h-28"
          aria-invalid={error ? true : undefined}
          disabled={isPending}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        {error && <FieldError>{error}</FieldError>}
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Сохраняем…" : "Добавить заметку"}
        </Button>
        <span className="text-xs text-muted-foreground">
          или Ctrl + Enter
        </span>
      </div>
    </form>
  );
}
