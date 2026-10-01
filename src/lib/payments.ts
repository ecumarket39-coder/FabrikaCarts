import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { packById, type PackId, type PayMethod } from "@/lib/catalog";

export type PaymentView = {
  id: string;
  packId: string;
  credits: number;
  amountKopecks: number;
  method: PayMethod;
  status: string;
  provider: "yookassa" | "demo";
  confirmationUrl: string | null;
  qrSvg: string | null;
  qrPayload: string | null;
  description: string;
  createdAt: string;
  paidAt: string | null;
};

export type ReceiptView = {
  id: string;
  paymentId: string;
  number: string;
  payload: Record<string, string>;
  createdAt: string;
};

export const createPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { packId: PackId; method: PayMethod; idempotencyKey: string }) => {
    if (!packById(input.packId)) throw new Error("Unknown pack");
    if (input.method !== "sbp" && input.method !== "qr") throw new Error("Unknown method");
    const key = input.idempotencyKey?.trim();
    if (!key || key.length < 8 || key.length > 128) throw new Error("Bad idempotency key");
    return { packId: input.packId, method: input.method, idempotencyKey: key };
  })
  .handler(async ({ context, data }) => {
    const { createPaymentForUser } = await import("@/lib/payments.server");
    return createPaymentForUser(context.userId, data);
  });

export const getPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const { loadPaymentForUser } = await import("@/lib/payments.server");
    return loadPaymentForUser(context.userId, id);
  });

export const listPayments = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listPaymentsForUser } = await import("@/lib/payments.server");
    return listPaymentsForUser(context.userId);
  });

export const confirmDemoPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const { confirmDemoForUser } = await import("@/lib/payments.server");
    return confirmDemoForUser(context.userId, id);
  });

export const listReceipts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listReceiptsForUser } = await import("@/lib/payments.server");
    return listReceiptsForUser(context.userId);
  });

export const reconcileMyPayments = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { reconcileForUser } = await import("@/lib/payments.server");
    return reconcileForUser(context.userId);
  });

export const paymentMode = createServerFn({ method: "GET" }).handler(async () => {
  const { yookassaConfigured } = await import("@/lib/yookassa.server");
  return { provider: yookassaConfigured() ? ("yookassa" as const) : ("demo" as const) };
});
