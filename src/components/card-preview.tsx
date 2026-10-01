import type { JobResult, Marketplace } from "@/lib/generate";

export function CardPreview({
  marketplace,
  result,
  title,
}: {
  marketplace: Marketplace;
  result: JobResult;
  title: string;
}) {
  const market = marketplace === "ozon" ? "Ozon" : "Wildberries";
  return (
    <article className="overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 text-xs uppercase tracking-[0.18em] text-muted">
        <span>{market}</span>
        <span>1080×1440</span>
      </div>
      {result.heroUrl ? (
        <img src={result.heroUrl} alt="" className="aspect-[3/4] w-full object-cover" />
      ) : (
        <div
          className="aspect-[3/4] w-full bg-bg"
          dangerouslySetInnerHTML={{ __html: result.svg.replace(/^<\?xml[^>]*>/, "") }}
        />
      )}
      <div className="space-y-3 p-5">
        <h3 className="font-display text-lg font-medium leading-snug">{result.seo.title || title}</h3>
        <ul className="space-y-1.5 text-sm text-muted">
          {result.seo.bullets.map((b) => (
            <li key={b} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
