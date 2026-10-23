"use client";

import { useOptimistic, useTransition } from "react";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";

import { checkIn, clearTodayCheckIns } from "@/app/actions";

/**
 * "Связались сегодня" in the card. Saves at once with its own action, so it
 * stays outside the contact form and never submits it.
 */
export function CheckInToggle({
  contactId,
  checkedInToday,
  lastCheckIn,
}: {
  contactId: string;
  checkedInToday: boolean;
  // Date of the last check-in if it was not today, formatted on the server
  lastCheckIn: string | null;
}) {
  // Ticks at once; the due line follows when the server answers
  const [checked, setChecked] = useOptimistic(checkedInToday);
  const [, startTransition] = useTransition();
  const id = `check-in-${contactId}`;
  const lastCheckInId = `${id}-last`;
  const showLastCheckIn = !checked && lastCheckIn !== null;

  function toggle(next: boolean) {
    startTransition(async () => {
      setChecked(next);
      const result = next
        ? await checkIn(contactId)
        : await clearTodayCheckIns(contactId);
      if (result.status === "error") {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-3">
        <span className="relative flex size-5 shrink-0">
          <input
            id={id}
            type="checkbox"
            checked={checked}
            onChange={(event) => toggle(event.target.checked)}
            aria-describedby={showLastCheckIn ? lastCheckInId : undefined}
            className="peer size-5 appearance-none rounded-checkbox border border-input bg-card transition-colors outline-none checked:border-brand checked:bg-brand focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <CheckIcon
            aria-hidden
            className="pointer-events-none absolute inset-0 m-auto size-4 stroke-3 text-primary-foreground opacity-0 peer-checked:opacity-100"
          />
        </span>
        <label htmlFor={id} className="text-sm font-semibold">
          Связались сегодня
        </label>
      </div>
      {showLastCheckIn && (
        <p id={lastCheckInId} className="pl-8 text-sm text-muted-foreground">
          Последняя отметка — {lastCheckIn}
        </p>
      )}
    </div>
  );
}
