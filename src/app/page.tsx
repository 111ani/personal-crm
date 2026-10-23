import { Suspense } from "react";

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

export default function ContactsPage({ searchParams }: PageProps<"/">) {
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
        <AddContactDialog />
      </div>

      {/* No placeholder: the block may well not be there at all */}
      <Suspense>
        <DueContacts searchParams={searchParams} />
      </Suspense>

      <Suspense fallback={<ContactListSkeleton />}>
        <ContactList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
