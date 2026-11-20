"use client";

import { useState, useTransition } from "react";

import { createGroup } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function NewGroupForm() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createGroup(name);
      if (result.status === "created") {
        setName("");
        setError(null);
      } else {
        // Keep what was typed: only the message is new
        setError(result.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="new-group-name">Новая группа</FieldLabel>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            id="new-group-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            disabled={isPending}
            className="h-12 bg-card sm:flex-1"
          />
          <Button type="submit" size="lg" disabled={isPending}>
            {isPending ? "Создаём…" : "Создать группу"}
          </Button>
        </div>
        {error && <FieldError>{error}</FieldError>}
      </Field>
    </form>
  );
}
