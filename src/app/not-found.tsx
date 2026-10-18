import Link from "next/link";
import { UserRoundXIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-brand">
        <UserRoundXIcon className="size-6" />
      </span>
      <h1 className="font-heading text-card-title font-medium">
        Ничего не нашлось
      </h1>
      <p className="max-w-sm text-soft-foreground">
        Такой страницы или контакта нет. Возможно, ссылка устарела.
      </p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        К списку контактов
      </Link>
    </div>
  );
}
