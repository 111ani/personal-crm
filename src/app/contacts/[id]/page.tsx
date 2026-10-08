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
import { getContactWithNotes } from "@/lib/contacts/queries";
import { contactIdSchema } from "@/lib/contacts/validation";
import { formatCount, formatDateTime } from "@/lib/format";

export const metadata: Metadata = {
  title: "Контакт — Личная CRM",
};

export default function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  return (
    <div className="grid gap-6">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
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
  const { contact, notes } = data;

  return (
    <>
      <div className="flex items-start gap-4">
        <ContactAvatar name={contact.name} size="lg" />
        <div className="grid min-w-0 gap-2">
          <div className="grid gap-0.5">
            <h1 className="font-heading text-2xl font-semibold tracking-tight break-words">
              {contact.name}
            </h1>
            {contact.about && (
              <p className="text-muted-foreground">{contact.about}</p>
            )}
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            {contact.phone && (
              <li>
                <a
                  href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
                  className="inline-flex items-center gap-1.5 hover:underline"
                >
                  <PhoneIcon className="size-4 text-muted-foreground" />
                  {contact.phone}
                </a>
              </li>
            )}
            {contact.email && (
              <li>
                <a
                  href={`mailto:${contact.email}`}
                  className="inline-flex items-center gap-1.5 break-all hover:underline"
                >
                  <MailIcon className="size-4 text-muted-foreground" />
                  {contact.email}
                </a>
              </li>
            )}
            {contact.howWeMet && (
              <li className="inline-flex items-center gap-1.5 text-muted-foreground">
                <HandshakeIcon className="size-4" />
                {contact.howWeMet}
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
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
          <CardContent>
            <EditContactForm
              contactId={contact.id}
              initialValues={{
                name: contact.name,
                about: contact.about ?? "",
                howWeMet: contact.howWeMet ?? "",
                phone: contact.phone ?? "",
                email: contact.email ?? "",
              }}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function NotesList({ notes }: { notes: Note[] }) {
  if (notes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        Заметок пока нет. Запишите, о чём поговорили, — в следующий раз будет
        проще вспомнить контекст.
      </p>
    );
  }

  return (
    <ol className="grid gap-3">
      {notes.map((note) => (
        <li key={note.id} className="rounded-lg bg-muted/50 px-4 py-3">
          <time
            dateTime={note.createdAt.toISOString()}
            className="text-xs text-muted-foreground"
          >
            {formatDateTime(note.createdAt)}
          </time>
          <p className="mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap">
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
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="grid gap-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}
