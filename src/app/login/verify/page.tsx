"use client";

import { useEffect, useRef } from "react";

export default function VerifyLinkPage() {
  const submitted = useRef(false);
  useEffect(() => {
    if (submitted.current) return;
    submitted.current = true;
    const token = window.location.hash.slice(1);
    if (!/^[a-f0-9]{64}$/.test(token)) {
      window.location.replace("/login/expired");
      return;
    }

    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/auth/verify";
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "token";
    input.value = token;
    form.append(input);
    document.body.append(form);
    window.history.replaceState(null, "", window.location.pathname);
    form.submit();
  }, []);

  return (
    <p role="status" className="text-center text-soft-foreground">
      Проверяем ссылку для входа…
    </p>
  );
}
