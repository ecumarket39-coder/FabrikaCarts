import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowRight, Factory, QrCode, ShieldCheck, WalletCards } from "lucide-react";
import { Shell } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { PACKS } from "@/lib/catalog";
import { formatRub, pluralCredits } from "@/lib/format";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <Shell>
      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-20">
          <div className="space-y-6">
            <Badge>СБП · QR · пакеты кредитов</Badge>
            <h1 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
              Карточки для витрины собираются в цехе, а не в чате с дизайнером.
            </h1>
            <p className="max-w-xl text-lg text-muted">
              Загрузите товар — получите инфографику 1080×1440, заголовок и описание под Wildberries или Ozon. Оплата пакетами, без подписки.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/studio"
                className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-sm)] bg-fg px-5 text-sm font-medium text-surface"
              >
                Собрать карточку
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#packs"
                className="inline-flex h-12 items-center rounded-[var(--radius-sm)] border border-border-strong bg-surface px-5 text-sm font-medium"
              >
                Пакеты
              </a>
            </div>
            <p className="text-sm text-faint">3 кредита при регистрации. 1 кредит = 1 карточка.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SampleCard
              market="WB"
              title="Кофе арабика, 250 г"
              bullets={["Светлая обжарка", "Ноты какао", "Клапан на пакете"]}
              tone="ink"
            />
            <SampleCard
              market="OZON"
              title="Крем для рук, 75 мл"
              bullets={["Ши и пантенол", "Без отдушки", "Дозатор"]}
              tone="paper"
            />
          </div>
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
            <Step icon={<Factory className="h-5 w-5" />} title="Станок" text="Фото, название, площадка. Цех пишет SEO и собирает кадр." />
            <Step icon={<WalletCards className="h-5 w-5" />} title="Кредиты" text="Списание только на сервере. Сбой генерации — кредит возвращается." />
            <Step icon={<QrCode className="h-5 w-5" />} title="Касса" text="СБП и QR через ЮKassa. Повтор вебхука не начисляет кредиты дважды." />
          </div>
        </section>

        <section id="packs" className="mx-auto max-w-6xl px-4 py-16">
          <div className="mb-8 max-w-xl space-y-3">
            <h2 className="font-display text-3xl tracking-tight">Пакеты, не подписка</h2>
            <p className="text-muted">Кредиты не сгорают в конце месяца. Оплата в рублях, СБП или QR.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {PACKS.map((pack) => (
              <article
                key={pack.id}
                className={`flex flex-col rounded-[var(--radius-xl)] border bg-surface p-6 shadow-[var(--shadow-card)] ${
                  pack.popular ? "border-fg" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl">{pack.name}</h3>
                  {pack.popular ? <Badge className="border-fg text-fg">Ход смены</Badge> : null}
                </div>
                <p className="mt-2 text-sm text-muted">{pack.blurb}</p>
                <p className="mt-6 font-display text-4xl tabular-nums tracking-tight">{formatRub(pack.priceRub)}</p>
                <p className="mt-1 text-sm text-muted">{pluralCredits(pack.credits)}</p>
                <Link
                  to="/cabinet"
                  className="mt-8 inline-flex h-11 items-center justify-center rounded-[var(--radius-sm)] bg-fg text-sm font-medium text-surface"
                >
                  Купить
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="flex items-start gap-3 rounded-[var(--radius-xl)] border border-border bg-surface p-6">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <div className="space-y-2 text-sm text-muted">
              <p className="font-medium text-fg">Как закрыт дубляж оплаты</p>
              <p>
                У каждого заказа свой idempotency_key. Вебхук ЮKassa сверяется запросом к кассе: сумма и валюта должны совпасть. Кредиты начисляются в одном SQL-выражении вместе с переходом заказа в «оплачен». Повтор уведомления возвращает тот же успех, без второго зачисления.
              </p>
            </div>
          </div>
        </section>
      </main>
    </Shell>
  );
}

function Step({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="space-y-2">
      <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] bg-bg">{icon}</div>
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-muted">{text}</p>
    </div>
  );
}

function SampleCard({
  market,
  title,
  bullets,
  tone,
}: {
  market: string;
  title: string;
  bullets: string[];
  tone: "ink" | "paper";
}) {
  const dark = tone === "ink";
  return (
    <article
      className={`aspect-[3/4] rounded-[var(--radius-lg)] p-4 ${dark ? "bg-fg text-surface" : "bg-bg text-fg border border-border"}`}
    >
      <p className="text-[10px] uppercase tracking-[0.2em] opacity-70">{market}</p>
      <div className={`mt-4 h-[42%] rounded-[var(--radius-sm)] ${dark ? "bg-surface/10" : "bg-surface"}`} />
      <h3 className="mt-4 font-display text-base leading-snug">{title}</h3>
      <ul className="mt-3 space-y-1 text-xs opacity-80">
        {bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </article>
  );
}
