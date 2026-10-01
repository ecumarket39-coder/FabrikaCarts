export function Mark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      <rect width="36" height="36" rx="8" fill="#1A1714" />
      <rect x="4" y="4" width="28" height="28" rx="5" fill="#F7F1E8" />
      <text
        x="18"
        y="24"
        textAnchor="middle"
        fill="#1A1714"
        fontFamily="Unbounded, sans-serif"
        fontSize="13"
        fontWeight="600"
      >
        КЦ
      </text>
    </svg>
  );
}
