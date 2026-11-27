import Link from "next/link";

import { ContactAvatar } from "@/components/contacts/contact-avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { listUpcomingBirthdays } from "@/lib/contacts/queries";

const celebrationFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

export async function UpcomingBirthdays({
  ownerId,
  searchParams,
}: {
  ownerId: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { q } = await searchParams;
  if (typeof q === "string" && q.trim()) return null;

  const birthdays = await listUpcomingBirthdays(ownerId);
  if (birthdays.length === 0) return null;

  return (
    <Card
      role="region"
      aria-labelledby="upcoming-birthdays-title"
      className="gap-3"
    >
      <CardHeader>
        <h2
          id="upcoming-birthdays-title"
          className="font-heading text-card-title font-medium"
        >
          Скоро день рождения
        </h2>
      </CardHeader>
      <CardContent>
        <ol className="divide-y">
          {birthdays.map(({ id, name, celebrationDate }) => (
            <li key={id}>
              <Link
                href={`/contacts/${id}`}
                className="flex items-center gap-3 rounded-md px-2 py-2 outline-none hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <ContactAvatar name={name} />
                <span className="min-w-0 flex-1 font-medium break-words">
                  {name}
                </span>
                <time
                  dateTime={celebrationDate}
                  className="shrink-0 text-muted-foreground"
                >
                  {celebrationFormat.format(new Date(celebrationDate))}
                </time>
              </Link>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
