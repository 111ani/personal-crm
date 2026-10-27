"use client";

import { useId, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CircleCheckIcon,
} from "lucide-react";
import { toast } from "sonner";

import { checkIn, undoCheckIn } from "@/app/actions";
import { ContactAvatar } from "@/components/contacts/contact-avatar";
import { cn } from "@/lib/utils";

const COLLAPSED_COUNT = 5;

// Longer than the app's other messages: time to press "Отменить"
const UNDO_DURATION_MS = 6000;

// A ticked row stays in place this long, so a quick second tap lands on the
// same tick and not on the next row's
const HIDE_DELAY_MS = 500;

export type DueContactRow = {
  id: string;
  name: string;
  // "раз в месяц"
  frequency: string;
  // "просрочено на 2 недели"
  overdue: string;
};

export function DueContactsBlock({ contacts }: { contacts: DueContactRow[] }) {
  // A checked-in row hides after a pause; if checking in fails, it comes back
  const [rows, hideRow] = useOptimistic(contacts, (current, id: string) =>
    current.filter((row) => row.id !== id),
  );
  // Rows ticked but not hidden yet
  const [tickedIds, tickRow] = useOptimistic<string[], string>(
    [],
    (current, id) => [...current, id],
  );
  const [expanded, setExpanded] = useState(false);
  const [, startTransition] = useTransition();
  const titleId = useId();

  if (rows.length === 0) {
    return null;
  }

  const visibleRows = expanded ? rows : rows.slice(0, COLLAPSED_COUNT);

  function handleCheckIn(row: DueContactRow) {
    startTransition(async () => {
      tickRow(row.id);
      const saving = checkIn(row.id);
      await new Promise((resolve) => setTimeout(resolve, HIDE_DELAY_MS));
      // React forgets the transition after an await, so start it again
      startTransition(() => hideRow(row.id));
      const result = await saving;
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      toast(`${row.name} — отмечено, что связались`, {
        duration: UNDO_DURATION_MS,
        action: {
          label: "Отменить",
          // Not through this component: after the last row it is gone. The
          // row comes back when the server answers
          onClick: async () => {
            const undo = await undoCheckIn(result.checkInId);
            if (undo.status === "error") {
              toast.error(undo.message);
            }
          },
        },
      });
    });
  }

  return (
    <section aria-labelledby={titleId} className="grid gap-4">
      <h2
        id={titleId}
        className="text-eyebrow font-semibold text-brand uppercase"
      >
        Пора связаться · {rows.length}
      </h2>

      <div className="overflow-hidden rounded-card bg-card ring-1 ring-border">
        <ul className="divide-y">
          {visibleRows.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-2 pr-2 transition-colors duration-150 has-[a:hover]:bg-secondary/60 md:pr-4"
            >
              <Link
                href={`/contacts/${row.id}`}
                className="flex min-w-0 flex-1 items-center gap-4 py-3.5 pl-4 outline-none focus-visible:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset md:pl-6"
              >
                <ContactAvatar name={row.name} />
                <span className="min-w-0">
                  <span className="block truncate font-heading text-name font-medium">
                    {row.name}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {row.frequency} ·{" "}
                    <span className="font-semibold text-brand">
                      {row.overdue}
                    </span>
                  </span>
                </span>
              </Link>
              {/* Next to the link, not inside it: a tick never opens the card */}
              <button
                type="button"
                onClick={() => handleCheckIn(row)}
                disabled={tickedIds.includes(row.id)}
                aria-label={`Отметить, что связались: ${row.name}`}
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-primary transition-colors outline-none hover:bg-secondary hover:text-brand focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <CircleCheckIcon
                  className={cn(
                    "size-7",
                    tickedIds.includes(row.id)
                      ? "fill-brand text-brand [&_path]:stroke-primary-foreground"
                      : "[&_path]:stroke-input",
                  )}
                />
              </button>
            </li>
          ))}
        </ul>

        {rows.length > COLLAPSED_COUNT && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="flex w-full items-center justify-center gap-2 border-t py-3.5 text-sm font-semibold text-brand transition-colors outline-none hover:bg-secondary/60 focus-visible:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
          >
            {expanded ? (
              <>
                Свернуть
                <ChevronUpIcon className="size-4" />
              </>
            ) : (
              <>
                Показать всех ({rows.length})
                <ChevronDownIcon className="size-4" />
              </>
            )}
          </button>
        )}
      </div>
    </section>
  );
}
