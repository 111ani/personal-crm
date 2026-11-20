"use client";

import { useId, useState, useTransition } from "react";
import { CheckIcon, PlusIcon } from "lucide-react";

import { createGroup, type GroupSummary } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { FieldError, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

// Russian alphabet, letter case aside: the same order as the list of groups
const byName = new Intl.Collator("ru-RU", { sensitivity: "base" });

/**
 * "Группы" in the contact form: one label per group, ticked ones go to the
 * server as hidden `groupIds` fields and are saved with the rest of the form.
 * The ticks live in this component, so a failed save or the form reset after
 * saving never unticks them
 */
export function ContactGroupsField({
  groups,
  initialGroupIds,
  disabled,
}: {
  groups: GroupSummary[];
  initialGroupIds: string[];
  disabled?: boolean;
}) {
  const [ticked, setTicked] = useState(() => new Set(initialGroupIds));
  // Groups created from this field: they show up at once, before the page
  // refreshes and the server list catches up
  const [created, setCreated] = useState<GroupSummary[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const labelId = useId();

  const all = [...groups];
  for (const group of created) {
    if (!all.some((known) => known.id === group.id)) {
      all.push(group);
    }
  }
  all.sort((a, b) => byName.compare(a.name, b.name) || a.id.localeCompare(b.id));

  function toggle(groupId: string) {
    setTicked((current) => {
      const next = new Set(current);
      if (!next.delete(groupId)) {
        next.add(groupId);
      }
      return next;
    });
  }

  function handleGroupReady(group: GroupSummary) {
    setCreated((current) => [...current, group]);
    setTicked((current) => new Set(current).add(group.id));
    setIsAdding(false);
  }

  return (
    <FieldSet className="gap-2">
      <FieldLegend variant="label" id={labelId} className="mb-0">
        Группы
      </FieldLegend>
      {/* Only the groups that still exist: one deleted in another tab is not
          sent, and the server would skip it anyway */}
      {all
        .filter((group) => ticked.has(group.id))
        .map((group) => (
          <input
            key={group.id}
            type="hidden"
            name="groupIds"
            value={group.id}
          />
        ))}
      <div
        role="group"
        aria-labelledby={labelId}
        className="flex flex-wrap items-center gap-2"
      >
        {all.length === 0 && !isAdding && (
          <p className="text-sm text-muted-foreground">Групп пока нет</p>
        )}
        {all.map((group) => {
          const isTicked = ticked.has(group.id);
          return (
            <Button
              key={group.id}
              type="button"
              variant={isTicked ? "default" : "outline"}
              aria-pressed={isTicked}
              disabled={disabled}
              onClick={() => toggle(group.id)}
              className="h-11 max-w-full"
            >
              {isTicked && <CheckIcon />}
              <span className="truncate">{group.name}</span>
            </Button>
          );
        })}
        {!isAdding && (
          <Button
            type="button"
            variant="link"
            disabled={disabled}
            onClick={() => setIsAdding(true)}
            className="h-11"
          >
            <PlusIcon />
            Новая группа
          </Button>
        )}
      </div>
      {isAdding && (
        <NewGroupRow
          disabled={disabled}
          onReady={handleGroupReady}
          onCancel={() => setIsAdding(false)}
        />
      )}
    </FieldSet>
  );
}

function NewGroupRow({
  disabled,
  onReady,
  onCancel,
}: {
  disabled?: boolean;
  onReady: (group: GroupSummary) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const errorId = useId();

  function create() {
    startTransition(async () => {
      const result = await createGroup(name);
      if (result.status === "error") {
        // Keep what was typed: only the message is new
        setError(result.message);
        return;
      }
      // A group with this name already exists: just tick it, no error
      onReady(result.group);
    });
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        {/* No `name`: this field never goes to the server with the form */}
        <Input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            // Enter creates the group; it must not save the whole form
            if (event.key === "Enter") {
              event.preventDefault();
              create();
            } else if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
          }}
          aria-label="Название новой группы"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          placeholder="Например, Теннис"
          autoComplete="off"
          autoFocus
          disabled={disabled || isPending}
          className="sm:flex-1"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            disabled={disabled || isPending}
            onClick={create}
            className="h-11"
          >
            {isPending ? "Создаём…" : "Создать"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || isPending}
            onClick={onCancel}
            className="h-11"
          >
            Отмена
          </Button>
        </div>
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}
