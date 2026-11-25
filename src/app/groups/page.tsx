import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, UsersIcon } from "lucide-react";

import { GroupRow } from "@/components/groups/group-row";
import { NewGroupForm } from "@/components/groups/new-group-form";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";
import { listGroups } from "@/lib/groups/queries";

export const metadata: Metadata = {
  title: "Группы — Личная CRM",
};

export default function GroupsPage() {
  return (
    <Suspense>
      <GroupsPageContent />
    </Suspense>
  );
}

async function GroupsPageContent() {
  const { id: ownerId } = await requireUser();
  return (
    <div className="grid gap-6 md:gap-8">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-2 rounded-sm text-sm font-semibold text-brand transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeftIcon className="size-4" />
        Все контакты
      </Link>

      <h1 className="font-heading text-title font-medium">Группы</h1>

      <NewGroupForm />

      <Suspense fallback={<GroupListSkeleton />}>
        <GroupList ownerId={ownerId} />
      </Suspense>
    </div>
  );
}

async function GroupList({ ownerId }: { ownerId: string }) {
  const groups = await listGroups(ownerId);

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-card bg-card px-6 py-14 text-center ring-1 ring-border">
        <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-secondary text-brand [&_svg]:size-6">
          <UsersIcon />
        </span>
        <p className="text-sm text-muted-foreground">
          Групп пока нет. Создайте первую — например, «Семья» или «Теннис».
        </p>
      </div>
    );
  }

  return (
    <section aria-label="Группы">
      <ul className="divide-y overflow-hidden rounded-card bg-card ring-1 ring-border">
        {groups.map((group) => (
          <GroupRow
            key={group.id}
            id={group.id}
            name={group.name}
            contactCount={group.contactCount}
          />
        ))}
      </ul>
    </section>
  );
}

function GroupListSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-card bg-card ring-1 ring-border"
      aria-busy="true"
      aria-label="Загружаем группы"
    >
      <ul className="divide-y">
        {Array.from({ length: 3 }, (_, index) => (
          <li key={index} className="px-4 py-5 md:px-6">
            <Skeleton className="h-5 w-48" />
          </li>
        ))}
      </ul>
    </div>
  );
}
