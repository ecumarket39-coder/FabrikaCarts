import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export type WalletView = {
  credits: number;
  bonusGranted: boolean;
};

export type LedgerRow = {
  id: string;
  delta: number;
  reason: string;
  refType: string;
  refId: string;
  createdAt: string;
};

export const getWallet = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<WalletView> => {
    const { ensureWallet } = await import("@/lib/wallet.server");
    return ensureWallet(context.userId);
  });

export const listLedger = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<LedgerRow[]> => {
    const { ensureWallet } = await import("@/lib/wallet.server");
    const { getSql } = await import("@/lib/db");
    await ensureWallet(context.userId);
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      delta: number;
      reason: string;
      ref_type: string;
      ref_id: string;
      created_at: unknown;
    }>`
      select id, delta, reason, ref_type, ref_id, created_at
      from credit_ledger
      where user_id = ${context.userId}
      order by created_at desc
      limit 40
    `;
    return rows.map((r) => ({
      id: r.id,
      delta: r.delta,
      reason: r.reason,
      refType: r.ref_type,
      refId: r.ref_id,
      createdAt: new Date(r.created_at as string).toISOString(),
    }));
  });
