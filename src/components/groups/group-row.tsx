"use client";

import { useState, useTransition } from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";

import { deleteGroup, renameGroup } from "@/app/actions";
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
import { Input } from "@/components/ui/input";
import { formatGroupSize } from "@/lib/format";

export function GroupRow({
  id,
  name,
  contactCount,
}: {
  id: string;
  name: string;
  contactCount: number;
}) {
  const [isRenaming, setIsRenaming] = useState(false);

  return (
    <li className="px-4 py-4 md:px-6">
      {isRenaming ? (
        <RenameForm
          id={id}
          name={name}
          onDone={() => setIsRenaming(false)}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <p className="min-w-0 font-heading text-name font-medium break-words">
            {name}
            <span className="font-sans text-base font-normal text-muted-foreground">
              {" — "}
              {formatGroupSize(contactCount)}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsRenaming(true)}
            >
              <PencilIcon />
              Переименовать
              <span className="sr-only"> группу «{name}»</span>
            </Button>
            <DeleteGroupDialog id={id} name={name} />
          </div>
        </div>
      )}
    </li>
  );
}

function RenameForm({
  id,
  name,
  onDone,
}: {
  id: string;
  name: string;
  onDone: () => void;
}) {
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await renameGroup(id, value);
      if (result.status === "success") {
        onDone();
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-3 sm:flex-row sm:items-start"
    >
      <div className="grid gap-2 sm:flex-1">
        <label htmlFor={`rename-group-${id}`} className="sr-only">
          Название группы
        </label>
        <Input
          id={`rename-group-${id}`}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              onDone();
            }
          }}
          autoComplete="off"
          autoFocus
          aria-invalid={error ? true : undefined}
          disabled={isPending}
          className="h-12 bg-card"
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Сохраняем…" : "Сохранить"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={isPending}
          onClick={onDone}
        >
          Отмена
        </Button>
      </div>
    </form>
  );
}

function DeleteGroupDialog({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteGroup(id);
      if (result.status === "success") {
        setOpen(false);
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setError(null);
        }
      }}
    >
      <DialogTrigger render={<Button variant="destructive" />}>
        <Trash2Icon />
        Удалить
        <span className="sr-only"> группу «{name}»</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Удалить группу «{name}»?</DialogTitle>
          <DialogDescription>
            Люди останутся в контактах, только выйдут из этой группы.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <DialogClose
            render={<Button type="button" variant="outline" />}
            disabled={isPending}
          >
            Отмена
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={handleDelete}
          >
            {isPending ? "Удаляем…" : "Удалить группу"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
