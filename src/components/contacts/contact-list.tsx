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

const rowGrid =
  "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 md:grid-cols-[auto_minmax(0,1fr)_11rem_15rem]";

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
    <section aria-label="Контакты" className="grid gap-3">
      <p className="text-sm text-muted-foreground" aria-live="polite">
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
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <div
            className={cn(
              rowGrid,
              "hidden border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground md:grid",
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
                  className={cn(isNew && "bg-amber-50")}
                >
                  {isNew && <ScrollIntoView />}
                  <Link
                    href={`/contacts/${contact.id}`}
                    className={cn(
                      rowGrid,
                      "px-4 py-3 transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
                    )}
                  >
                    <ContactAvatar name={contact.name} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">
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
                        <span className="block truncate text-sm text-muted-foreground md:hidden">
                          {[contact.phone, contact.email]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                    </span>
                    <span className="hidden truncate text-sm tabular-nums md:block">
                      {contact.phone ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </span>
                    <span className="hidden truncate text-sm md:block">
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
    <div className="flex flex-col items-center gap-2 rounded-xl bg-card px-6 py-12 text-center ring-1 ring-foreground/10">
      <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5">
        {icon}
      </span>
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

export function ContactListSkeleton() {
  return (
    <div className="grid gap-3" aria-busy="true" aria-label="Загружаем контакты">
      <Skeleton className="h-4 w-40" />
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <ul className="divide-y">
          {Array.from({ length: 8 }, (_, index) => (
            <li key={index} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="size-9 rounded-full" />
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
