import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { PACKS, PAY_METHODS, type PackId, type PayMethod } from "@/lib/catalog";
import { formatKopecks, formatRub, pluralCredits } from "@/lib/format";
import { getWallet, listLedger, type LedgerRow } from "@/lib/wallet";
import {
  createPayment,
  listPayments,
  listReceipts,
  paymentMode,
  reconcileMyPayments,
  type PaymentView,
  type ReceiptView,
} from "@/lib/payments";
import { listJobs, type JobView } from "@/lib/generate";

export const Route = createFileRoute("/cabinet")({ component: CabinetPage });

function CabinetPage() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <Shell>
        <main className="mx-auto max-w-6xl px-4 py-12">
          <div className="h-40 animate-pulse rounded-[var(--radius-xl)] bg-fg/10" />
        </main>
      </Shell>
    );
  }
  if (!user) return <RedirectToSignIn />;
  return (
    <Shell>
      <Cabinet />
    </Shell>
  );
}

function Cabinet() {
  const navigate = useNavigate();
  const [credits, setCredits] = useState(0);
  const [method, setMethod] = useState<PayMethod>("sbp");
  const [busyPack, setBusyPack] = useState<PackId | null>(null);
  const [mode, setMode] = useState<"demo" | "yookassa">("demo");
  const [payments, setPayments] = useState<PaymentView[]>([]);
  const [jobs, setJobs] = useState<JobView[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [receipts, setReceipts] = useState<ReceiptView[]>([]);

  async function reload() {
    const [w, p, j, l, r, m] = await Promise.all([
      getWallet(),
      listPayments(),
      listJobs(),
      listLedger(),
      listReceipts(),
      paymentMode(),
    ]);
    setCredits(w.credits);
    setPayments(p);
    setJobs(j);
    setLedger(l);
    setReceipts(r);
    setMode(m.provider);
  }

  useEffect(() => {
    void reload().catch((err) => toast.error(err instanceof Error ? err.message : "Кабинет недоступен"));
  }, []);

  async function buy(packId: PackId) {
    setBusyPack(packId);
    try {
      const storageKey = `kartotseh:idem:${packId}:${method}`;
      let key = sessionStorage.getItem(storageKey);
      if (!key) {
        key = crypto.randomUUID();
        sessionStorage.setItem(storageKey, key);
      }
      const payment = await createPayment({ data: { packId, method, idempotencyKey: key } });
      await navigate({ to: "/pay/$orderId", params: { orderId: payment.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось создать заказ");
    } finally {
      setBusyPack(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Кабинет</h1>
          <p className="mt-1 text-muted">Баланс, пакеты, история смен и квитанции</p>
        </div>
        <p className="font-display text-4xl tabular-nums">{pluralCredits(credits)}</p>
      </header>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl">Купить пакет</h2>
          <div className="flex gap-2">
            {PAY_METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                className={`h-10 rounded-[var(--radius-sm)] border px-3 text-sm ${
                  method === m.id ? "border-fg bg-fg text-surface" : "border-border bg-surface"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-muted">
          Касса: {mode === "yookassa" ? "ЮKassa (боевой контур)" : "демо СБП/QR — без списания с карты, тот же серверный контур"}.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {PACKS.map((pack) => (
            <article key={pack.id} className="flex flex-col rounded-[var(--radius-xl)] border border-border bg-surface p-5">
              <h3 className="font-display text-lg">{pack.name}</h3>
              <p className="mt-1 text-sm text-muted">{pack.blurb}</p>
              <p className="mt-4 font-display text-3xl tabular-nums">{formatRub(pack.priceRub)}</p>
              <p className="text-sm text-muted">{pluralCredits(pack.credits)}</p>
              <Button className="mt-5" disabled={busyPack === pack.id} onClick={() => void buy(pack.id)}>
                {busyPack === pack.id ? "Создаём заказ…" : `Оплатить ${method === "qr" ? "QR" : "СБП"}`}
              </Button>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">Платежи</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              void reconcileMyPayments()
                .then(() => reload())
                .then(() => toast.success("Статусы сверены"))
            }
          >
            Сверить
          </Button>
        </div>
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
          {payments.length === 0 ? (
            <p className="p-4 text-sm text-muted">Заказов ещё нет</p>
          ) : (
            <ul className="divide-y divide-border">
              {payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{p.description}</p>
                    <p className="text-xs text-muted tabular-nums">{p.id.slice(0, 8)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums">{formatKopecks(p.amountKopecks)}</span>
                    <StatusBadge status={p.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Смены</h2>
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
          {jobs.length === 0 ? (
            <p className="p-4 text-sm text-muted">Карточек ещё нет — откройте станок</p>
          ) : (
            <ul className="divide-y divide-border">
              {jobs.map((j) => (
                <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{j.productTitle}</p>
                    <p className="text-xs text-muted">
                      {j.marketplace === "ozon" ? "Ozon" : "Wildberries"} · {new Date(j.createdAt).toLocaleString("ru-RU")}
                    </p>
                  </div>
                  <StatusBadge status={j.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-display text-xl">Квитанции</h2>
          <ul className="divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-surface">
            {receipts.length === 0 ? (
              <li className="p-4 text-sm text-muted">Появятся после оплаты</li>
            ) : (
              receipts.map((r) => (
                <li key={r.id} className="px-4 py-3 text-sm">
                  <p className="font-medium">{r.number}</p>
                  <p className="text-muted">{r.payload.amount} · {r.payload.description}</p>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="space-y-3">
          <h2 className="font-display text-xl">Движение кредитов</h2>
          <ul className="divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-surface">
            {ledger.length === 0 ? (
              <li className="p-4 text-sm text-muted">Пусто</li>
            ) : (
              ledger.map((row) => (
                <li key={row.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-muted">{reasonLabel(row.reason)}</span>
                  <span className={`tabular-nums ${row.delta > 0 ? "text-accent" : "text-fg"}`}>
                    {row.delta > 0 ? "+" : ""}
                    {row.delta}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "оплачен",
    pending: "ждёт",
    created: "создан",
    canceled: "отменён",
    failed: "сбой",
    done: "готово",
    running: "в работе",
    queued: "в очереди",
    refunded: "возврат",
  };
  return <Badge>{map[status] ?? status}</Badge>;
}

function reasonLabel(reason: string): string {
  const map: Record<string, string> = {
    signup_bonus: "Стартовые кредиты",
    purchase: "Покупка пакета",
    generation: "Сборка карточки",
    refund: "Возврат за сбой",
  };
  return map[reason] ?? reason;
}
