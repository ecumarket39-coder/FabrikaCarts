import { env } from "@/lib/env.server";
import { kopecksToYooValue } from "@/lib/catalog";

export type YooPayment = {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled" | string;
  paid: boolean;
  amount: { value: string; currency: string };
  confirmation?: {
    type: string;
    confirmation_url?: string;
    confirmation_data?: string;
  };
  metadata?: Record<string, string>;
  payment_method?: { type?: string };
};

export function yookassaConfigured(): boolean {
  return Boolean(env("YOOKASSA_SHOP_ID") && env("YOOKASSA_SECRET_KEY"));
}

function authHeader(): string {
  const id = env("YOOKASSA_SHOP_ID");
  const secret = env("YOOKASSA_SECRET_KEY");
  if (!id || !secret) throw new Error("YooKassa is not configured");
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

export async function yooCreatePayment(input: {
  idempotencyKey: string;
  amountKopecks: number;
  description: string;
  method: "sbp" | "qr";
  returnUrl: string;
  orderId: string;
  customerEmail?: string | null;
}): Promise<YooPayment> {
  const body = {
    amount: { value: kopecksToYooValue(input.amountKopecks), currency: "RUB" },
    capture: true,
    payment_method_data: { type: "sbp" },
    confirmation:
      input.method === "qr"
        ? { type: "qr" }
        : { type: "redirect", return_url: input.returnUrl },
    description: input.description,
    metadata: { order_id: input.orderId },
    receipt: {
      customer: {
        email: input.customerEmail || "receipt@kartotseh.app",
      },
      items: [
        {
          description: input.description.slice(0, 128),
          quantity: "1.00",
          amount: { value: kopecksToYooValue(input.amountKopecks), currency: "RUB" },
          vat_code: 1,
          payment_subject: "service",
          payment_mode: "full_payment",
        },
      ],
    },
  };

  const res = await fetch("https://api.yookassa.ru/v3/payments", {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Idempotence-Key": input.idempotencyKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as YooPayment & { code?: string; description?: string };
  if (!res.ok) {
    throw new Error(json.description || `YooKassa error ${res.status}`);
  }
  return json;
}

export async function yooGetPayment(id: string): Promise<YooPayment> {
  const res = await fetch(`https://api.yookassa.ru/v3/payments/${id}`, {
    headers: { Authorization: authHeader() },
  });
  const json = (await res.json()) as YooPayment & { description?: string };
  if (!res.ok) {
    throw new Error(json.description || `YooKassa get error ${res.status}`);
  }
  return json;
}

export function yooAmountToKopecks(value: string, currency: string): number | null {
  if (currency !== "RUB") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}
