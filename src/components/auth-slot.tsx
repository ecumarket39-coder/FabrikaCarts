import { Link } from "@tanstack/react-router";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function AuthSlot() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return <div className="h-8 w-28 animate-pulse rounded-full bg-fg/10" />;
  }
  if (user) return <UserButton />;
  return (
    <Link
      to="/login"
      className="inline-flex h-10 items-center rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm font-medium"
    >
      Войти
    </Link>
  );
}
