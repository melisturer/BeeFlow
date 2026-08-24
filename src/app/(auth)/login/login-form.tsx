"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormField, TextInput } from "@/components/ui/form-field";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: String(form.get("email")),
      password: String(form.get("password")),
      redirect: false,
    });
    setPending(false);
    if (res?.error) {
      setError("E-posta veya şifre hatalı.");
      return;
    }
    router.push(searchParams.get("callbackUrl") || "/");
    router.refresh();
  }

  return (
    <div className="bf-login-form">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--da-purple)]">
        Giriş
      </p>
      <h1 className="bf-page-title mt-2">Panele hoş geldin</h1>
      <p className="bf-page-sub">
        Ekip görevleri, içerik onayı ve ajans akışı seni bekliyor.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <FormField label="E-posta" htmlFor="email">
          <TextInput
            id="email"
            name="email"
            type="email"
            required
            defaultValue="admin@beeflow.local"
            autoComplete="email"
          />
        </FormField>
        <FormField label="Şifre" htmlFor="password">
          <TextInput
            id="password"
            name="password"
            type="password"
            required
            defaultValue="password123"
            autoComplete="current-password"
          />
        </FormField>
        {error ? (
          <p className="text-sm font-semibold text-[var(--da-danger)]">{error}</p>
        ) : null}
        <button
          type="submit"
          className="bf-btn bf-btn-dark w-full"
          disabled={pending}
        >
          {pending ? "Giriş yapılıyor..." : "Panele gir"}
        </button>
      </form>

      <p className="mt-5 text-xs text-[var(--da-muted)]">
        Demo: admin@beeflow.local / password123
      </p>
    </div>
  );
}
