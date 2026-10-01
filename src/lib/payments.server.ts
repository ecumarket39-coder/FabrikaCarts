import { getSql } from "@/lib/db";
import { packById, rubToKopecks, type PackId, type PayMethod } from "@/lib/catalog";
import { newId, sha256 } from "@/lib/ids";
import { publicOrigin } from "@/lib/origin.server";
import { logOps } from "@/lib/ops.server";
import { ensureWallet } from "@/lib/wallet.server";
import { fulfillPaidPayment, markPaymentCanceled } from "@/lib/fulfill.server";
import {
  yooCreatePayment,
  yooGetPayment,
  yooAmountToKopecks,
  yookassaConfigured,
} from "@/lib/yookassa.server";
import { qrSvg } from "@/lib/qr";
import type { PaymentView, ReceiptView } from "@/lib/payments";

type PaymentDb = {
  id: string;
  user_id: string;
  pack_id: string;
  credits: number;
  amount_kopecks: number;
  method: string;
  status: string;
  provider: string;
  confirmation_url: string | null;
  qr_payload: string | null;
  description: string;
  created_at: unknown;
  paid_at: unknown;
  provider_payment_id?: string | null;
};

export function toPaymentView(row: PaymentDb): PaymentView {
  const payload = row.qr_payload;
  return {
    id: row.id,
    packId: row.pack_id,
    credits: row.credits,
    amountKopecks: row.amount_kopecks,
    method: row.method as PayMethod,
    status: row.status,
    provider: row.provider === "yookassa" ? "yookassa" : "demo",
    confirmationUrl: row.confirmation_url,
    qrSvg: payload ? qrSvg(payload) : null,
    qrPayload: payload,
    description: row.description,
    createdAt: new Date(row.created_at as string).toISOString(),
    paidAt: row.paid_at ? new Date(row.paid_at as string).toISOString() : null,
  };
}

export async function createPaymentForUser(
  userId: string,
  data: { packId: PackId; method: PayMethod; idempotencyKey: string },
): Promise<PaymentView> {
  await ensureWallet(userId);
  const pack = packById(data.packId);
  if (!pack) throw new Error("Unknown pack");
  const sql = await getSql();

  const existing = await sql<PaymentDb>`
    select id, user_id, pack_id, credits, amount_kopecks, method, status, provider,
           confirmation_url, qr_payload, description, created_at, paid_at, provider_payment_id
    from payments
    where idempotency_key = ${data.idempotencyKey} and user_id = ${userId}
    limit 1
  `;
  if (existing[0]) return toPaymentView(existing[0]);

  const recent = await sql<{ n: number }>`
    select count(*)::int as n from payments
    where user_id = ${userId} and created_at > now() - interval '10 minutes'
  `;
  if ((recent[0]?.n ?? 0) >= 8) {
    throw new Error("Слишком много попыток оплаты. Подождите несколько минут.");
  }

  const id = newId();
  const amountKopecks = rubToKopecks(pack.priceRub);
  const description = `Картоцех · пакет «${pack.name}» · ${pack.credits} кр.`;
  const live = yookassaConfigured();
  const origin = publicOrigin();
  const returnUrl = `${origin}/pay/${id}`;

  let provider: "yookassa" | "demo" = live ? "yookassa" : "demo";
  let providerPaymentId: string | null = live ? null : `demo_${id}`;
  let confirmationUrl: string | null = null;
  let qrPayload: string | null = `${origin}/pay/${id}`;
  const status = "pending";

  if (live) {
    try {
      const yoo = await yooCreatePayment({
        idempotencyKey: data.idempotencyKey,
        amountKopecks,
        description,
        method: data.method,
        returnUrl,
        orderId: id,
      });
      providerPaymentId = yoo.id;
      confirmationUrl = yoo.confirmation?.confirmation_url ?? null;
      qrPayload = yoo.confirmation?.confirmation_data ?? confirmationUrl ?? qrPayload;
    } catch (err) {
      await logOps("error", "yookassa_create_fail", "YooKassa create failed, falling back to demo", {
        message: err instanceof Error ? err.message : String(err),
      });
      provider = "demo";
      providerPaymentId = `demo_${id}`;
    }
  }

  try {
    const inserted = await sql<PaymentDb>`
      insert into payments (
        id, user_id, pack_id, credits, amount_kopecks, currency, method, status,
        idempotency_key, provider, provider_payment_id, confirmation_url, qr_payload, description
      ) values (
        ${id}, ${userId}, ${pack.id}, ${pack.credits}, ${amountKopecks}, 'RUB', ${data.method},
        ${status}, ${data.idempotencyKey}, ${provider}, ${providerPaymentId}, ${confirmationUrl},
        ${qrPayload}, ${description}
      )
      returning id, user_id, pack_id, credits, amount_kopecks, method, status, provider,
                confirmation_url, qr_payload, description, created_at, paid_at, provider_payment_id
    `;
    return toPaymentView(inserted[0]);
  } catch {
    const again = await sql<PaymentDb>`
      select id, user_id, pack_id, credits, amount_kopecks, method, status, provider,
             confirmation_url, qr_payload, description, created_at, paid_at, provider_payment_id
      from payments
      where idempotency_key = ${data.idempotencyKey} and user_id = ${userId}
      limit 1
    `;
    if (again[0]) return toPaymentView(again[0]);
    throw new Error("Не удалось создать заказ");
  }
}

export async function loadPaymentForUser(userId: string, id: string): Promise<PaymentView | null> {
  const sql = await getSql();
  const rows = await sql<PaymentDb>`
    select id, user_id, pack_id, credits, amount_kopecks, method, status, provider,
           confirmation_url, qr_payload, description, created_at, paid_at, provider_payment_id
    from payments
    where id = ${id} and user_id = ${userId}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  if ((row.status === "pending" || row.status === "created") && row.provider === "yookassa") {
    await refreshYooPayment(row.id);
    const fresh = await sql<PaymentDb>`
      select id, user_id, pack_id, credits, amount_kopecks, method, status, provider,
             confirmation_url, qr_payload, description, created_at, paid_at, provider_payment_id
      from payments
      where id = ${id} and user_id = ${userId}
      limit 1
    `;
    return fresh[0] ? toPaymentView(fresh[0]) : toPaymentView(row);
  }
  return toPaymentView(row);
}

export async function listPaymentsForUser(userId: string): Promise<PaymentView[]> {
  const sql = await getSql();
  const rows = await sql<PaymentDb>`
    select id, user_id, pack_id, credits, amount_kopecks, method, status, provider,
           confirmation_url, qr_payload, description, created_at, paid_at, provider_payment_id
    from payments
    where user_id = ${userId}
    order by created_at desc
    limit 30
  `;
  return rows.map(toPaymentView);
}

export async function confirmDemoForUser(userId: string, id: string) {
  const sql = await getSql();
  const rows = await sql<PaymentDb>`
    select id, user_id, pack_id, credits, amount_kopecks, method, status, provider,
           confirmation_url, qr_payload, description, created_at, paid_at, provider_payment_id
    from payments
    where id = ${id} and user_id = ${userId}
    limit 1
  `;
  const row = rows[0];
  if (!row) throw new Error("Заказ не найден");
  if (row.provider !== "demo") throw new Error("Этот заказ ждёт вебхук ЮKassa");
  const result = await fulfillPaidPayment({
    paymentId: row.id,
    expectedKopecks: row.amount_kopecks,
    providerPaymentId: row.provider_payment_id,
    providerStatus: "succeeded",
  });
  if (!result.ok) throw new Error("Не удалось подтвердить оплату");
  const fresh = await sql<PaymentDb>`
    select id, user_id, pack_id, credits, amount_kopecks, method, status, provider,
           confirmation_url, qr_payload, description, created_at, paid_at, provider_payment_id
    from payments where id = ${id} and user_id = ${userId} limit 1
  `;
  return {
    payment: toPaymentView(fresh[0]),
    granted: result.granted,
    balance: result.balance,
    first: result.first,
  };
}

export async function listReceiptsForUser(userId: string): Promise<ReceiptView[]> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    payment_id: string;
    number: string;
    payload_json: string;
    created_at: unknown;
  }>`
    select id, payment_id, number, payload_json, created_at
    from receipts
    where user_id = ${userId}
    order by created_at desc
    limit 30
  `;
  return rows.map((r) => ({
    id: r.id,
    paymentId: r.payment_id,
    number: r.number,
    payload: JSON.parse(r.payload_json) as Record<string, string>,
    createdAt: new Date(r.created_at as string).toISOString(),
  }));
}

export async function reconcileForUser(userId: string) {
  const sql = await getSql();
  const pending = await sql<{ id: string; provider: string }>`
    select id, provider from payments
    where user_id = ${userId}
      and status in ('created', 'pending')
      and created_at > now() - interval '2 days'
  `;
  let checked = 0;
  for (const p of pending) {
    if (p.provider === "yookassa") {
      await refreshYooPayment(p.id);
      checked += 1;
    }
  }
  return { checked };
}

export async function refreshYooPayment(paymentId: string): Promise<void> {
  if (!yookassaConfigured()) return;
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    provider_payment_id: string | null;
    amount_kopecks: number;
    status: string;
  }>`
    select id, provider_payment_id, amount_kopecks, status from payments where id = ${paymentId} limit 1
  `;
  const row = rows[0];
  if (!row?.provider_payment_id || row.status === "paid") return;
  try {
    const yoo = await yooGetPayment(row.provider_payment_id);
    if (yoo.status === "succeeded" && yoo.paid) {
      const kopecks = yooAmountToKopecks(yoo.amount.value, yoo.amount.currency);
      if (kopecks === null || kopecks !== row.amount_kopecks) {
        await logOps("error", "payment_mismatch", "YooKassa amount mismatch on refresh", {
          paymentId,
          yoo: yoo.amount,
          expected: row.amount_kopecks,
        });
        return;
      }
      await fulfillPaidPayment({
        paymentId,
        expectedKopecks: row.amount_kopecks,
        providerPaymentId: yoo.id,
        providerStatus: yoo.status,
      });
    } else if (yoo.status === "canceled") {
      await markPaymentCanceled(paymentId, yoo.status);
    }
  } catch (err) {
    await logOps("warn", "yookassa_refresh_fail", err instanceof Error ? err.message : String(err), {
      paymentId,
    });
  }
}

export async function ingestYookassaWebhook(rawBody: string): Promise<{ ok: boolean; duplicate?: boolean }> {
  const hash = await sha256(rawBody);
  let parsed: {
    event?: string;
    object?: {
      id?: string;
      status?: string;
      paid?: boolean;
      amount?: { value: string; currency: string };
      metadata?: { order_id?: string };
    };
  };
  try {
    parsed = JSON.parse(rawBody) as typeof parsed;
  } catch {
    return { ok: false };
  }

  const sql = await getSql();
  const eventId = `${parsed.event ?? "unknown"}:${parsed.object?.id ?? hash}`;
  try {
    await sql`
      insert into webhook_events (id, provider, event_type, payment_id, payload_hash)
      values (${eventId}, 'yookassa', ${parsed.event ?? ""}, ${parsed.object?.id ?? null}, ${hash})
    `;
  } catch {
    return { ok: true, duplicate: true };
  }

  const obj = parsed.object;
  if (!obj?.id) return { ok: true };

  if (!yookassaConfigured()) {
    await logOps("warn", "webhook_no_keys", "Webhook received but YooKassa keys are missing", {
      event: parsed.event,
    });
    return { ok: true };
  }

  let yoo;
  try {
    yoo = await yooGetPayment(obj.id);
  } catch (err) {
    await logOps("error", "webhook_verify_fail", "Could not fetch payment from YooKassa", {
      id: obj.id,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false };
  }

  const orderId = yoo.metadata?.order_id;
  const found = await sql<{ id: string; amount_kopecks: number; status: string }>`
    select id, amount_kopecks, status from payments
    where provider = 'yookassa' and (provider_payment_id = ${yoo.id} or id = ${orderId ?? ""})
    limit 1
  `;
  const payment = found[0];
  if (!payment) {
    await logOps("error", "webhook_unknown", "YooKassa payment has no matching order — credits NOT granted", {
      yooId: yoo.id,
      orderId,
      amount: yoo.amount,
    });
    return { ok: true };
  }

  if (yoo.status === "canceled") {
    await markPaymentCanceled(payment.id, yoo.status);
    return { ok: true };
  }

  if (yoo.status === "succeeded" && yoo.paid) {
    const kopecks = yooAmountToKopecks(yoo.amount.value, yoo.amount.currency);
    if (kopecks === null || kopecks !== payment.amount_kopecks) {
      await logOps("error", "payment_mismatch", "Webhook amount mismatch — credits NOT granted", {
        paymentId: payment.id,
        expected: payment.amount_kopecks,
        got: yoo.amount,
      });
      return { ok: true };
    }
    await fulfillPaidPayment({
      paymentId: payment.id,
      expectedKopecks: payment.amount_kopecks,
      providerPaymentId: yoo.id,
      providerStatus: yoo.status,
    });
  }
  return { ok: true };
}

export { yookassaConfigured };
