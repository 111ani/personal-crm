import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeftIcon,
  HandshakeIcon,
  MailIcon,
  PhoneIcon,
} from "lucide-react";

import { AddNoteForm } from "@/components/contacts/add-note-form";
import { ContactAvatar } from "@/components/contacts/contact-avatar";
import { DeleteContactDialog } from "@/components/contacts/delete-contact-dialog";
import type { DueLine } from "@/components/contacts/contact-frequency-field";
import { EditContactForm } from "@/components/contacts/edit-contact-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Note } from "@/db/schema";
import {
  getContactWithNotes,
  type ContactDue,
} from "@/lib/contacts/queries";
import { contactIdSchema } from "@/lib/contacts/validation";
import {
  formatCount,
  formatDateTime,
  formatDayMonth,
  formatOverdue,
} from "@/lib/format";

export const metadata: Metadata = {
  title: "Контакт — Личная CRM",
};

export default function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  return (
    <div className="grid gap-6 md:gap-8">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-2 rounded-sm text-sm font-semibold text-brand transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeftIcon className="size-4" />
        Все контакты
      </Link>
      <Suspense fallback={<ContactDetailsSkeleton />}>
        <ContactDetails params={params} />
      </Suspense>
    </div>
  );
}

async function ContactDetails({
  params,
}: {
  params: PageProps<"/contacts/[id]">["params"];
}) {
  const { id } = await params;
  if (!contactIdSchema.safeParse(id).success) {
    notFound();
  }

  const data = await getContactWithNotes(id);
  if (!data) {
    notFound();
  }
  const { contact, notes, due } = data;

  return (
    <>
      <div className="flex items-start gap-4 md:gap-6">
        <ContactAvatar name={contact.name} size="lg" />
        <div className="grid min-w-0 gap-3 md:gap-4">
          <div className="grid gap-1.5 md:gap-2">
            <h1 className="font-heading text-title font-medium break-words">
              {contact.name}
            </h1>
            {contact.about && (
              <p className="text-lead text-soft-foreground">{contact.about}</p>
            )}
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm md:text-base">
            {contact.phone && (
              <li>
                <a
                  href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
                  className="inline-flex items-start gap-2 transition-colors hover:text-brand"
                >
                  <PhoneIcon className="mt-0.5 size-4 shrink-0 text-brand md:mt-1" />
                  {contact.phone}
                </a>
              </li>
            )}
            {contact.email && (
              <li>
                <a
                  href={`mailto:${contact.email}`}
                  className="inline-flex items-start gap-2 break-all transition-colors hover:text-brand"
                >
                  <MailIcon className="mt-0.5 size-4 shrink-0 text-brand md:mt-1" />
                  {contact.email}
                </a>
              </li>
            )}
            {contact.howWeMet && (
              <li className="inline-flex items-start gap-2 text-soft-foreground">
                <HandshakeIcon className="mt-0.5 size-4 shrink-0 text-brand md:mt-1" />
                {contact.howWeMet}
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="grid items-start gap-4 md:gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Заметки</CardTitle>
            <CardDescription>
              Что обсудили и о чём договорились —{" "}
              {notes.length > 0
                ? formatCount(notes.length, ["запись", "записи", "записей"])
                : "пока пусто"}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <AddNoteForm contactId={contact.id} />
            <NotesList notes={notes} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Данные контакта</CardTitle>
            <CardDescription>
              Добавлен {formatDateTime(contact.createdAt)}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <EditContactForm
              contactId={contact.id}
              initialValues={{
                name: contact.name,
                about: contact.about ?? "",
                howWeMet: contact.howWeMet ?? "",
                phone: contact.phone ?? "",
                email: contact.email ?? "",
              }}
              initialFrequency={{
                frequency: contact.contactFrequency ?? "",
                days: contact.contactFrequencyDays?.toString() ?? "",
              }}
              due={due && describeDue(due)}
              checkIn={
                due && {
                  checkedInToday: due.checkedInToday,
                  lastCheckIn:
                    !due.checkedInToday && due.lastCheckInAt
                      ? formatDayMonth(due.lastCheckInAt, due.now)
                      : null,
                }
              }
            />
            {/* Outside the edit form, so it can never submit it */}
            <div className="border-t pt-5">
              <DeleteContactDialog contactId={contact.id} name={contact.name} />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// Formatted here, on the server, like the note dates: the browser's time
// zone may differ
function describeDue(due: ContactDue): DueLine {
  return due.isDue
    ? {
        label: `Пора связаться — ${formatOverdue(due.overdueDays)}`,
        isDue: true,
      }
    : {
        label: `Связаться до ${formatDayMonth(due.dueAt, due.now)}`,
        isDue: false,
      };
}

function NotesList({ notes }: { notes: Note[] }) {
  if (notes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-input px-4 py-6 text-center text-sm text-muted-foreground">
        Заметок пока нет. Запишите, о чём поговорили, — в следующий раз будет
        проще вспомнить контекст.
      </p>
    );
  }

  return (
    <ol className="grid">
      {notes.map((note) => (
        <li key={note.id} className="border-t py-4 last:pb-0">
          <time
            dateTime={note.createdAt.toISOString()}
            className="text-xs font-semibold text-brand"
          >
            {formatDateTime(note.createdAt)}
          </time>
          <p className="mt-1.5 text-base leading-relaxed break-words whitespace-pre-wrap text-soft-foreground">
            {note.body}
          </p>
        </li>
      ))}
    </ol>
  );
}

function ContactDetailsSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Загружаем контакт">
      <div className="flex items-center gap-4 md:gap-6">
        <Skeleton className="size-16 rounded-full md:size-20" />
        <div className="grid gap-2">
          <Skeleton className="h-9 w-56 md:h-12 md:w-80" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Skeleton className="h-72 rounded-card" />
        <Skeleton className="h-72 rounded-card" />
      </div>
    </div>
  );
}
