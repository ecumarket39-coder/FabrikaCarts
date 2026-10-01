import { getSql } from "@/lib/db";
import { SIGNUP_BONUS_CREDITS } from "@/lib/catalog";
import { newId } from "@/lib/ids";
import type { WalletView } from "@/lib/wallet";

export async function ensureWallet(userId: string): Promise<WalletView> {
  const sql = await getSql();
  await sql`
    insert into wallets (user_id, credits, bonus_granted)
    values (${userId}, 0, false)
    on conflict (user_id) do nothing
  `;
  const ledgerId = newId();
  await sql`
    with led as (
      insert into credit_ledger (id, user_id, delta, reason, ref_type, ref_id)
      values (${ledgerId}, ${userId}, ${SIGNUP_BONUS_CREDITS}, 'signup_bonus', 'wallet', ${userId})
      on conflict (user_id, reason, ref_id) do nothing
      returning delta
    )
    update wallets
    set credits = credits + coalesce((select delta from led), 0),
        bonus_granted = bonus_granted or exists (select 1 from led),
        updated_at = now()
    where user_id = ${userId}
  `;
  const rows = await sql<{ credits: number; bonus_granted: boolean }>`
    select credits, bonus_granted from wallets where user_id = ${userId}
  `;
  return { credits: rows[0]?.credits ?? 0, bonusGranted: Boolean(rows[0]?.bonus_granted) };
}
