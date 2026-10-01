import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AuthSlot } from "@/components/auth-slot";
import { CreditsChip } from "@/components/credits-chip";
import { Mark } from "@/components/mark";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <Mark className="h-8 w-8" />
            <span className="font-display text-sm font-semibold tracking-tight">Картоцех</span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-muted sm:flex">
            <Link to="/studio" className="hover:text-fg">
              Цех
            </Link>
            <Link to="/cabinet" className="hover:text-fg">
              Кабинет
            </Link>
            <a href="/#packs" className="hover:text-fg">
              Пакеты
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <CreditsChip />
            <AuthSlot />
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>Картоцех — цех карточек для витрины маркетплейса.</p>
          <div className="flex flex-wrap gap-4">
            <Link to="/offer" className="hover:text-fg">
              Оферта
            </Link>
            <Link to="/privacy" className="hover:text-fg">
              Персональные данные
            </Link>
            <Link to="/studio" className="hover:text-fg">
              Собрать карточку
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
