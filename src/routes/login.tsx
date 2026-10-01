import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { SignInGate } from "@/lib/auth/gates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mark } from "@/components/mark";
import { Shell } from "@/components/shell";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <Shell>
      <main className="mx-auto grid min-h-[70dvh] max-w-md place-items-center px-4 py-12">
        <SignInGate fallback={<LoginForm />}>
          <div className="w-full space-y-4 rounded-[var(--radius-xl)] border border-border bg-surface p-6 text-center shadow-[var(--shadow-card)]">
            <p className="font-display text-xl">Вы уже в цехе</p>
            <Link to="/studio" className="inline-flex h-11 items-center justify-center rounded-[var(--radius-sm)] bg-fg px-4 text-sm font-medium text-surface">
              К станку
            </Link>
          </div>
        </SignInGate>
      </main>
    </Shell>
  );
}

function LoginForm() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "up") {
        const res = await authClient.signUp.email({ email, password, name: name || email.split("@")[0] });
        if (res.error) throw new Error(res.error.message);
      } else {
        const res = await authClient.signIn.email({ email, password });
        if (res.error) throw new Error(res.error.message);
      }
      window.location.href = "/studio";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full space-y-6 rounded-[var(--radius-xl)] border border-border bg-surface p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <Mark />
        <div>
          <h1 className="font-display text-xl">Вход в цех</h1>
          <p className="text-sm text-muted">Кредиты и карточки привязаны к аккаунту</p>
        </div>
      </div>
      {authEnabled ? (
        <>
          <div className="flex flex-col gap-2">
            {GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                type="button"
                variant="outline"
                onClick={() => signIn(p.providerId, { callbackURL: "/studio" })}
              >
                Продолжить с {p.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-faint">
            <span className="h-px flex-1 bg-border" />
            почта
            <span className="h-px flex-1 bg-border" />
          </div>
          <form className="space-y-3" onSubmit={onSubmit}>
            {mode === "up" ? (
              <div className="space-y-1.5">
                <Label htmlFor="name">Имя</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="email">Почта</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "up" ? "new-password" : "current-password"}
              />
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "…" : mode === "up" ? "Создать аккаунт" : "Войти"}
            </Button>
          </form>
          <button
            type="button"
            className="text-sm text-muted underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "up" ? "in" : "up")}
          >
            {mode === "up" ? "Уже есть аккаунт" : "Нет аккаунта — регистрация"}
          </button>
        </>
      ) : (
        <p className="text-sm text-muted">Вход выключен.</p>
      )}
    </div>
  );
}
