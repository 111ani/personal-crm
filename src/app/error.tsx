"use client";

import { useEffect } from "react";
import { TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlertIcon className="size-6" />
      </span>
      <h1 className="font-heading text-card-title font-medium">
        Не удалось загрузить данные
      </h1>
      <p className="max-w-md text-soft-foreground">
        Скорее всего, не запущена база данных. Проверьте, что Docker Desktop
        работает и выполнена команда <code>docker compose up -d</code>, затем
        попробуйте ещё раз.
      </p>
      <Button variant="outline" onClick={() => retry()}>
        Попробовать ещё раз
      </Button>
    </div>
  );
}
