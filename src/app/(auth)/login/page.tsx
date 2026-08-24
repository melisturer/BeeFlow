import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="bf-login">
      <section className="bf-login-hero">
        <div className="bf-login-hero-glow" aria-hidden />
        <div className="bf-login-hero-orb bf-login-hero-orb-a" aria-hidden />
        <div className="bf-login-hero-orb bf-login-hero-orb-b" aria-hidden />

        <div className="bf-login-hero-top">
          <h1 className="bf-login-brand">BeeFlow</h1>
        </div>
      </section>

      <section className="bf-login-panel">
        <Suspense
          fallback={<div className="text-[var(--da-muted)]">Yükleniyor...</div>}
        >
          <LoginForm />
        </Suspense>
      </section>
    </div>
  );
}
