import { DueContactsBlock } from "@/components/contacts/due-contacts-block";
import { listDueContacts } from "@/lib/contacts/queries";
import { formatFrequency, formatOverdue } from "@/lib/format";

/**
 * "Пора связаться" on the home page. Nothing while the search has a query
 * (not to get in the way) or when nobody is due.
 */
export async function DueContacts({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  if (query) {
    return null;
  }

  const contacts = await listDueContacts();
  if (contacts.length === 0) {
    return null;
  }

  return (
    <DueContactsBlock
      contacts={contacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
        frequency: formatFrequency(contact.frequency, contact.frequencyDays),
        overdue: formatOverdue(contact.overdueDays),
      }))}
    />
  );
}
