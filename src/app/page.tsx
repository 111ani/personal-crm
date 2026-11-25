import { Suspense } from "react";
import { PlusIcon } from "lucide-react";

import { AddContactDialog } from "@/components/contacts/add-contact-dialog";
import {
  ContactList,
  ContactListSkeleton,
} from "@/components/contacts/contact-list";
import { DueContacts } from "@/components/contacts/due-contacts";
import {
  SearchInput,
  SearchInputFallback,
} from "@/components/contacts/search-input";
import { GroupFilter } from "@/components/groups/group-filter";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { listGroups } from "@/lib/groups/queries";

// The "Новый контакт" window needs the groups for its "Группы" field
async function AddContact({ ownerId }: { ownerId: string }) {
  const groups = await listGroups(ownerId);
  return (
    <AddContactDialog groups={groups.map(({ id, name }) => ({ id, name }))} />
  );
}

// The same button, not active until the groups are read
function AddContactButtonFallback() {
  return (
    <Button size="lg" disabled>
      <PlusIcon />
      Добавить контакт
    </Button>
  );
}

export default function ContactsPage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense>
      <ContactsPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ContactsPageContent({
  searchParams,
}: Pick<PageProps<"/">, "searchParams">) {
  const { id: ownerId } = await requireUser();
  return (
    <div className="grid gap-8 md:gap-10">
      <div className="grid gap-3 md:gap-4">
        <h1 className="font-heading text-title font-medium">Контакты</h1>
        <p className="max-w-140 text-lead text-soft-foreground">
          Люди, которых вы знаете лично, и о чём вы с ними договорились.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Suspense fallback={<SearchInputFallback />}>
          <SearchInput />
        </Suspense>
        <Suspense fallback={<AddContactButtonFallback />}>
          <AddContact ownerId={ownerId} />
        </Suspense>
      </div>

      {/* No placeholder: with no groups there is no row at all */}
      <Suspense>
        <GroupFilter ownerId={ownerId} searchParams={searchParams} />
      </Suspense>

      {/* No placeholder: the block may well not be there at all */}
      <Suspense>
        <DueContacts ownerId={ownerId} searchParams={searchParams} />
      </Suspense>

      <Suspense fallback={<ContactListSkeleton />}>
        <ContactList ownerId={ownerId} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
