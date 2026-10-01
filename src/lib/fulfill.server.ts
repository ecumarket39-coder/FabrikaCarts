import { getSql } from "@/lib/db";
import { newId } from "@/lib/ids";
import { logOps } from "@/lib/ops.server";
import { formatKopecks, shortId } from "@/lib/format";

export type FulfillResult =
  | { ok: true; first: boolean; granted: number; balance: number; receiptId: string | null }
  | { ok: false; error: "not_found" | "not_pending" | "amount_mismatch" | "internal" };

type PaymentRow = {
  id: string;
  user_id: string;
  status: string;
  credits: number;
  amount_kopecks: number;
  pack_id: string;
  description: string;
};

export async function fulfillPaidPayment(input: {
  paymentId: string;
  expectedKopecks: number;
  providerPaymentId?: string | null;
  providerStatus?: string | null;
}): Promise<FulfillResult> {
  const sql = await getSql();
  const rows = await sql<PaymentRow>`
    select id, user_id, status, credits, amount_kopecks, pack_id, description
    from payments where id = ${input.paymentId}
  `;
  const payment = rows[0];
  if (!payment) return { ok: false, error: "not_found" };
  if (payment.amount_kopecks !== input.expectedKopecks) {
    await logOps("error", "payment_mismatch", "Webhook amount does not match order", {
      paymentId: payment.id,
      expected: payment.amount_kopecks,
      got: input.expectedKopecks,
    });
    return { ok: false, error: "amount_mismatch" };
  }
  if (payment.status === "paid") {
    const rec = await sql<{ id: string; credits: number }>`
      select r.id, w.credits
      from receipts r
      join wallets w on w.user_id = r.user_id
      where r.payment_id = ${payment.id}
      limit 1
    `;
    const bal = await sql<{ credits: number }>`select credits from wallets where user_id = ${payment.user_id}`;
    return {
      ok: true,
      first: false,
      granted: payment.credits,
      balance: rec[0]?.credits ?? bal[0]?.credits ?? 0,
      receiptId: rec[0]?.id ?? null,
    };
  }
  if (payment.status !== "created" && payment.status !== "pending") {
    return { ok: false, error: "not_pending" };
  }

  const ledgerId = newId();
  const receiptId = newId();
  const receiptNumber = `КТ-${shortId(payment.id)}`;
  const payload = JSON.stringify({
    number: receiptNumber,
    paymentId: payment.id,
    description: payment.description,
    amount: formatKopecks(payment.amount_kopecks),
    credits: payment.credits,
    note: "Демо-квитанция. Боевой чек 54-ФЗ пробивает ЮKassa после подключения магазина.",
  });
  const ppid = input.providerPaymentId ?? null;
  const pstatus = input.providerStatus ?? "succeeded";

  const moved = await sql<{ id: string; user_id: string; credits: number; balance: number; receipt_id: string }>`
    with moved as (
      update payments
      set
        status = 'paid',
        paid_at = now(),
        updated_at = now(),
        provider_payment_id = coalesce(${ppid}, provider_payment_id),
        provider_status = ${pstatus}
      where id = ${payment.id}
        and status in ('created', 'pending')
        and amount_kopecks = ${input.expectedKopecks}
      returning id, user_id, credits
    ),
    ens as (
      insert into wallets (user_id, credits, bonus_granted)
      select user_id, 0, false from moved
      on conflict (user_id) do nothing
    ),
    led as (
      insert into credit_ledger (id, user_id, delta, reason, ref_type, ref_id)
      select ${ledgerId}, user_id, credits, 'purchase', 'payment', id from moved
      returning user_id, delta
    ),
    upd as (
      update wallets w
      set credits = w.credits + led.delta, updated_at = now()
      from led
      where w.user_id = led.user_id
      returning w.user_id, w.credits as balance
    ),
    rcpt as (
      insert into receipts (id, payment_id, user_id, number, payload_json)
      select ${receiptId}, moved.id, moved.user_id, ${receiptNumber}, ${payload}
      from moved
      on conflict (payment_id) do nothing
      returning id, payment_id
    )
    select moved.id, moved.user_id, moved.credits, upd.balance, rcpt.id as receipt_id
    from moved
    join upd on true
    left join rcpt on true
  `;

  if (moved[0]) {
    await logOps("info", "payment_paid", "Credits granted for payment", {
      paymentId: payment.id,
      granted: moved[0].credits,
    });
    return {
      ok: true,
      first: true,
      granted: moved[0].credits,
      balance: moved[0].balance,
      receiptId: moved[0].receipt_id,
    };
  }

  const again = await sql<PaymentRow>`select id, user_id, status, credits, amount_kopecks, pack_id, description from payments where id = ${payment.id}`;
  if (again[0]?.status === "paid") {
    const bal = await sql<{ credits: number }>`select credits from wallets where user_id = ${payment.user_id}`;
    return { ok: true, first: false, granted: payment.credits, balance: bal[0]?.credits ?? 0, receiptId: null };
  }
  await logOps("warn", "fulfill_skipped", "Payment was not pending at fulfill", {
    paymentId: payment.id,
    status: again[0]?.status,
  });
  return { ok: false, error: "not_pending" };
}

export async function markPaymentCanceled(paymentId: string, providerStatus?: string): Promise<void> {
  const sql = await getSql();
  await sql`
    update payments
    set status = 'canceled',
        provider_status = ${providerStatus ?? "canceled"},
        updated_at = now()
    where id = ${paymentId} and status in ('created', 'pending')
  `;
}
