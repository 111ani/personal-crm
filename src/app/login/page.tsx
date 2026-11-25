import type { Metadata } from "next";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Вход — Личная CRM" };

export default function SignInPage() {
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <h1 className="font-heading text-card-title font-medium">
          Вход в Личную CRM
        </h1>
      </CardHeader>
      <CardContent>
        <SignInForm />
      </CardContent>
    </Card>
  );
}
