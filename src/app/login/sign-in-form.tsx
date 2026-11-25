"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { requestSignIn } from "./actions";

export function SignInForm() {
  const [state, action, pending] = useActionState(requestSignIn, {
    status: "idle",
  });
  const invalid = state.status === "invalid";

  return (
    <form action={action} noValidate className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="email">Почта</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.status === "idle" ? "" : state.email}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? "email-error" : undefined}
        />
        {invalid && (
          <p id="email-error" role="alert" className="text-sm text-destructive">
            Проверь адрес почты
          </p>
        )}
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        Получить ссылку
      </Button>
      {state.status === "sent" && (
        <p role="status" className="break-words text-sm text-soft-foreground">
          Ссылка для входа отправлена на {state.email}
        </p>
      )}
      {state.status === "limited" && (
        <p role="alert" className="text-sm text-destructive">
          Слишком часто, попробуй через несколько минут
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          Не удалось отправить письмо. Попробуй ещё раз
        </p>
      )}
    </form>
  );
}
