import type { Metadata } from "next";
import { Manrope, Playfair_Display } from "next/font/google";
import Link from "next/link";

import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

import "./globals.css";

// Same fonts as the landing. next/font downloads them at build time,
// so the browser loads them from the app itself, not from Google
const manrope = Manrope({
  subsets: ["cyrillic", "latin"],
  variable: "--font-manrope",
});

const playfair = Playfair_Display({
  subsets: ["cyrillic", "latin"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
});

export const metadata: Metadata = {
  title: "Личная CRM",
  description: "Люди, которых я знаю лично, и контекст общения с ними",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={cn("h-full antialiased", manrope.variable, playfair.variable)}
    >
      <body className="flex min-h-full flex-col">
        <header className="border-b">
          <div className="mx-auto flex w-full max-w-300 items-center px-5 py-5 md:px-10 md:py-7">
            <Link
              href="/"
              className="rounded-sm text-eyebrow font-semibold text-brand uppercase outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Личная CRM
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-300 flex-1 px-5 pt-8 pb-12 md:px-10 md:pt-12 md:pb-20">
          {children}
        </main>
        <Toaster theme="light" position="bottom-right" />
      </body>
    </html>
  );
}
