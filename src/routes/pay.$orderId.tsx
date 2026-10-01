import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { confirmDemoPayment, getPayment, type PaymentView } from "@/lib/payments";
import { formatKopecks, pluralCredits } from "@/lib/format";

export const Route = createFileRoute("/pay/$orderId")({ component: PayPage });

function PayPage() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <Shell>
        <main className="mx-auto max-w-lg px-4 py-12">
          <div className="h-80 animate-pulse rounded-[var(--radius-xl)] bg-fg/10" />
        </main>
      </Shell>
    );
  }
  if (!user) return <RedirectToSignIn />;
  return (
    <Shell>
      <PayScreen />
    </Shell>
  );
}

function PayScreen() {
  const { orderId } = Route.useParams();
  const [payment, setPayment] = useState<PaymentView | null>(null);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);

  async function refresh() {
    const p = await getPayment({ data: orderId });
    if (!p) setMissing(true);
    else setPayment(p);
  }

  useEffect(() => {
    void refresh().catch(() => setMissing(true));
    const t = setInterval(() => {
      void refresh().catch(() => undefined);
    }, 2500);
    return () => clearInterval(t);
  }, [orderId]);

  async function confirmDemo() {
    setBusy(true);
    try {
      const res = await confirmDemoPayment({ data: orderId });
      setPayment(res.payment);
      if (res.first) toast.success(`Начислено ${pluralCredits(res.granted)}`);
      else toast.message("Этот заказ уже был оплачен — повторно кредиты не начислялись");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Оплата не прошла");
    } finally {
      setBusy(false);
    }
  }

  if (missing) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-display text-2xl">Заказ не найден</h1>
        <Link to="/cabinet" className="mt-4 inline-block text-sm underline underline-offset-4">
          В кабинет
        </Link>
      </main>
    );
  }

  if (!payment) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <div className="h-80 animate-pulse rounded-[var(--radius-xl)] bg-fg/10" />
      </main>
    );
  }

  const paid = payment.status === "paid";

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <div className="space-y-5 rounded-[var(--radius-xl)] border border-border bg-surface p-6 shadow-[var(--shadow-card)]">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">
          {payment.method === "qr" ? "Оплата по QR" : "СБП"}
        </p>
        <h1 className="font-display text-2xl leading-snug">{payment.description}</h1>
        <p className="font-display text-4xl tabular-nums">{formatKopecks(payment.amountKopecks)}</p>
        <p className="text-sm text-muted">{pluralCredits(payment.credits)} после подтверждения кассы</p>

        {paid ? (
          <div className="space-y-3 rounded-[var(--radius-md)] bg-accent/10 p-4">
            <p className="font-medium text-accent">Оплачено</p>
            <p className="text-sm text-muted">Кредиты уже на счёте. Повтор этого экрана ничего не спишет и не начислит.</p>
            <Link
              to="/studio"
              className="inline-flex h-11 items-center justify-center rounded-[var(--radius-sm)] bg-fg px-4 text-sm font-medium text-surface"
            >
              К станку
            </Link>
          </div>
        ) : (
          <>
            {payment.qrSvg ? (
              <div
                className="mx-auto max-w-[260px] overflow-hidden rounded-[var(--radius-md)] border border-border bg-bg p-3"
                dangerouslySetInnerHTML={{ __html: payment.qrSvg }}
              />
            ) : null}
            <p className="text-center text-sm text-muted">
              Откройте приложение банка, СБП или камеру. На desktop ЮKassa показывает QR, на телефоне — список банков.
            </p>
            {payment.confirmationUrl ? (
              <a
                href={payment.confirmationUrl}
                className="inline-flex h-11 w-full items-center justify-center rounded-[var(--radius-sm)] bg-fg text-sm font-medium text-surface"
              >
                Перейти в банк
              </a>
            ) : null}
            {payment.provider === "demo" ? (
              <div className="space-y-2 rounded-[var(--radius-md)] border border-border p-4">
                <p className="text-sm text-muted">
                  Демо-касса: карта не списывается. Кнопка гоняет тот же серверный путь, что и вебхук ЮKassa — идемпотентное начисление.
                </p>
                <Button className="w-full" disabled={busy} onClick={() => void confirmDemo()}>
                  {busy ? "Проводим…" : "Подтвердить оплату СБП (демо)"}
                </Button>
              </div>
            ) : (
              <p className="text-center text-xs text-faint">Ждём вебхук ЮKassa. Страница обновляется сама.</p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
