import { Suspense } from "react";

import { AddContactDialog } from "@/components/contacts/add-contact-dialog";
import {
  ContactList,
  ContactListSkeleton,
} from "@/components/contacts/contact-list";
import {
  SearchInput,
  SearchInputFallback,
} from "@/components/contacts/search-input";

export default function ContactsPage({ searchParams }: PageProps<"/">) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Контакты
        </h1>
        <p className="text-sm text-muted-foreground">
          Люди, которых вы знаете лично, и о чём вы с ними договорились.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Suspense fallback={<SearchInputFallback />}>
          <SearchInput />
        </Suspense>
        <AddContactDialog />
      </div>

      <Suspense fallback={<ContactListSkeleton />}>
        <ContactList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
