import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getWallet } from "@/lib/wallet";
import { pluralCredits } from "@/lib/format";

export function CreditsChip() {
  const { user, isPending } = useCurrentUserState();
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    if (isPending || !user) {
      setCredits(null);
      return;
    }
    let cancelled = false;
    getWallet()
      .then((w) => {
        if (!cancelled) setCredits(w.credits);
      })
      .catch(() => {
        if (!cancelled) setCredits(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user, isPending]);

  if (isPending) return <div className="h-10 w-24 animate-pulse rounded-[var(--radius-sm)] bg-fg/10" />;
  if (!user) return null;

  return (
    <Link
      to="/cabinet"
      className="inline-flex h-10 items-center rounded-[var(--radius-sm)] bg-accent px-3 text-sm font-medium text-accent-fg tabular-nums"
    >
      {credits === null ? "…" : pluralCredits(credits)}
    </Link>
  );
}
