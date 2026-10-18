import Link from "next/link";
import { SearchXIcon, UsersIcon } from "lucide-react";

import { ContactAvatar } from "@/components/contacts/contact-avatar";
import { ScrollIntoView } from "@/components/contacts/scroll-into-view";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { countContacts, listContacts } from "@/lib/contacts/queries";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

const CONTACT_FORMS: [string, string, string] = [
  "контакт",
  "контакта",
  "контактов",
];

// Phone and email columns only from `lg`: on tablets they would squeeze the name
const rowGrid =
  "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 lg:grid-cols-[auto_minmax(0,1fr)_11rem_15rem] lg:gap-x-6";

export async function ContactList({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const highlightId = typeof params.new === "string" ? params.new : null;

  const [items, total] = await Promise.all([
    listContacts(query),
    countContacts(),
  ]);

  if (total === 0) {
    return (
      <EmptyState
        icon={<UsersIcon />}
        title="Пока нет ни одного контакта"
        text="Нажмите «Добавить контакт», чтобы записать первого человека."
      />
    );
  }

  return (
    <section aria-label="Контакты" className="grid gap-4">
      <p
        className="text-eyebrow font-semibold text-brand uppercase"
        aria-live="polite"
      >
        {query
          ? `Найдено: ${formatCount(items.length, CONTACT_FORMS)} из ${total.toLocaleString("ru-RU")}`
          : `Всего ${formatCount(total, CONTACT_FORMS)}`}
      </p>

      {items.length === 0 ? (
        <EmptyState
          icon={<SearchXIcon />}
          title={`По запросу «${query}» никого не нашли`}
          text="Проверьте, как написано имя, или добавьте новый контакт."
        />
      ) : (
        <div className="overflow-hidden rounded-card bg-card ring-1 ring-border">
          <div
            className={cn(
              rowGrid,
              "hidden border-b px-6 py-4 text-eyebrow font-semibold text-brand uppercase lg:grid",
            )}
          >
            <span className="col-span-2">Имя</span>
            <span>Телефон</span>
            <span>Почта</span>
          </div>
          <ul className="divide-y">
            {items.map((contact) => {
              const isNew = contact.id === highlightId;
              return (
                <li
                  key={contact.id}
                  className={cn(isNew && "bg-highlight")}
                >
                  {isNew && <ScrollIntoView />}
                  <Link
                    href={`/contacts/${contact.id}`}
                    className={cn(
                      rowGrid,
                      "px-4 py-3.5 transition-colors duration-150 outline-none hover:bg-secondary/60 focus-visible:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset md:px-6",
                    )}
                  >
                    <ContactAvatar name={contact.name} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-heading text-name font-medium">
                          {contact.name}
                        </span>
                        {isNew && <Badge variant="secondary">Новый</Badge>}
                      </span>
                      {contact.about && (
                        <span className="block truncate text-sm text-muted-foreground">
                          {contact.about}
                        </span>
                      )}
                      {/* On narrow screens contacts go under the name */}
                      {(contact.phone || contact.email) && (
                        <span className="block truncate text-sm text-muted-foreground lg:hidden">
                          {[contact.phone, contact.email]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                    </span>
                    <span className="hidden truncate text-sm text-soft-foreground tabular-nums lg:block">
                      {contact.phone ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </span>
                    <span className="hidden truncate text-sm text-soft-foreground lg:block">
                      {contact.email ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card bg-card px-6 py-14 text-center ring-1 ring-border">
      <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-secondary text-brand [&_svg]:size-6">
        {icon}
      </span>
      <p className="font-heading text-card-title font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

export function ContactListSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Загружаем контакты">
      <Skeleton className="h-4 w-40" />
      <div className="overflow-hidden rounded-card bg-card ring-1 ring-border">
        <ul className="divide-y">
          {Array.from({ length: 8 }, (_, index) => (
            <li key={index} className="flex items-center gap-4 px-4 py-3.5 md:px-6">
              <Skeleton className="size-10 rounded-full" />
              <div className="grid flex-1 gap-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
