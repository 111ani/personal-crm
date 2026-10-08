import type { Metadata } from "next";
import Link from "next/link";
import { BookUserIcon } from "lucide-react";

import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

export const metadata: Metadata = {
  title: "Личная CRM",
  description: "Люди, которых я знаю лично, и контекст общения с ними",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-muted/30">
        <header className="border-b bg-background">
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-4 sm:px-6">
            <Link
              href="/"
              className="flex items-center gap-2 font-heading text-base font-semibold"
            >
              <BookUserIcon className="size-5" />
              Личная CRM
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
        <Toaster theme="light" position="bottom-right" richColors />
      </body>
    </html>
  );
}
