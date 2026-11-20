import Link from "next/link";
import { SettingsIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { buildHomeUrl, parseHomeParams } from "@/lib/groups/home-params";
import { listGroups } from "@/lib/groups/queries";
import { cn } from "@/lib/utils";

/**
 * The row of group buttons on the home page: "Все", the groups by alphabet,
 * and a link to the "Группы" page. Nothing while there are no groups. Every
 * button is a link to the home address with that group and the typed search
 */
export async function GroupFilter({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The address first: until it is known the page is built without a
  // request, and the database must not be asked (the build has none)
  const params = await searchParams;
  const groups = await listGroups();
  if (groups.length === 0) {
    return null;
  }
  const { query, groupId } = parseHomeParams(
    params,
    groups.map((group) => group.id),
  );

  const pill = (isSelected: boolean) =>
    cn(
      buttonVariants({ variant: isSelected ? "default" : "outline" }),
      "h-11 max-w-full",
    );

  return (
    <nav aria-label="Группы">
      <ul className="flex flex-wrap items-center gap-2">
        <li>
          <Link
            href={buildHomeUrl({ q: query })}
            aria-current={groupId === null ? "true" : undefined}
            className={pill(groupId === null)}
          >
            Все
          </Link>
        </li>
        {groups.map((group) => (
          <li key={group.id} className="max-w-full">
            <Link
              href={buildHomeUrl({ q: query, group: group.id })}
              aria-current={group.id === groupId ? "true" : undefined}
              className={pill(group.id === groupId)}
            >
              <span className="truncate">{group.name}</span>
            </Link>
          </li>
        ))}
        <li>
          <Link
            href="/groups"
            className={cn(
              buttonVariants({ variant: "link" }),
              "h-11 text-brand",
            )}
          >
            <SettingsIcon />
            Настроить группы
          </Link>
        </li>
      </ul>
    </nav>
  );
}
