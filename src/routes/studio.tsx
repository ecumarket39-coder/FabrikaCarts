import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, LoaderCircle } from "lucide-react";
import { Shell } from "@/components/shell";
import { CardPreview } from "@/components/card-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { startGeneration, getJob, type JobView, type Marketplace } from "@/lib/generate";
import { getWallet } from "@/lib/wallet";
import { zipStore } from "@/lib/zip";
import { pluralCredits } from "@/lib/format";

export const Route = createFileRoute("/studio")({ component: StudioPage });

function StudioPage() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <Shell>
        <main className="mx-auto max-w-6xl px-4 py-12">
          <div className="h-40 animate-pulse rounded-[var(--radius-xl)] bg-fg/10" />
        </main>
      </Shell>
    );
  }
  if (!user) return <RedirectToSignIn />;
  return (
    <Shell>
      <Studio />
    </Shell>
  );
}

function Studio() {
  const [marketplace, setMarketplace] = useState<Marketplace>("wb");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<JobView | null>(null);
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    getWallet()
      .then((w) => setCredits(w.credits))
      .catch(() => setCredits(null));
  }, [job]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 700_000) {
      toast.error("Фото до 700 КБ");
      return;
    }
    const data = await fileToDataUrl(file);
    setImage(data);
  }

  async function onGenerate() {
    setBusy(true);
    try {
      const created = await startGeneration({
        data: {
          requestId: crypto.randomUUID(),
          marketplace,
          productTitle: title,
          productNotes: notes,
          category,
          sourceImageData: image,
        },
      });
      setJob(created);
      let latest = created;
      if (created.status === "running" || created.status === "queued") {
        latest = await pollJob(created.id);
        setJob(latest);
      }
      if (latest.status === "failed") {
        toast.error(latest.error || "Сбой. Кредит возвращён, если списание было.");
      }
      const w = await getWallet();
      setCredits(w.credits);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось запустить станок");
    } finally {
      setBusy(false);
    }
  }

  const result = job?.status === "done" ? job.result : null;

  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="space-y-5">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Станок</h1>
          <p className="mt-1 text-muted">
            1 кредит за карточку. Сейчас:{" "}
            <span className="tabular-nums text-fg">{credits === null ? "…" : pluralCredits(credits)}</span>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMarketplace("wb")}
            className={`h-11 rounded-[var(--radius-sm)] border text-sm font-medium ${
              marketplace === "wb" ? "border-fg bg-fg text-surface" : "border-border bg-surface"
            }`}
          >
            Wildberries
          </button>
          <button
            type="button"
            onClick={() => setMarketplace("ozon")}
            className={`h-11 rounded-[var(--radius-sm)] border text-sm font-medium ${
              marketplace === "ozon" ? "border-fg bg-fg text-surface" : "border-border bg-surface"
            }`}
          >
            Ozon
          </button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="title">Название товара</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Кофе арабика, 250 г" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cat">Категория</Label>
          <Input id="cat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Продукты / кофе" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Факты и УТП</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Светлая обжарка, клапан, для фильтра"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="photo">Фото товара</Label>
          <Input
            id="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </div>
        <Button className="w-full" size="lg" disabled={busy || !title.trim()} onClick={() => void onGenerate()}>
          {busy ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Цех работает
            </>
          ) : (
            "Собрать карточку · 1 кредит"
          )}
        </Button>
        {credits === 0 ? (
          <p className="text-sm text-muted">
            Кредиты кончились.{" "}
            <Link to="/cabinet" className="underline underline-offset-4">
              Купить пакет
            </Link>
          </p>
        ) : null}
        {job?.status === "failed" ? <p className="text-sm text-danger">{job.error}</p> : null}
      </section>

      <section>
        {result ? (
          <div className="space-y-4">
            <CardPreview marketplace={marketplace} result={result} title={title} />
            <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4 text-sm">
              <p className="font-medium">SEO</p>
              <p className="mt-2 text-muted">{result.seo.description}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.14em] text-faint">
                {result.seo.keywords.join(" · ")}
              </p>
            </div>
            <Button variant="outline" className="w-full" onClick={() => void downloadJob(job!, result)}>
              <Download className="h-4 w-4" />
              Скачать ZIP
            </Button>
          </div>
        ) : (
          <div className="grid min-h-80 place-items-center rounded-[var(--radius-xl)] border border-dashed border-border-strong bg-surface p-8 text-center text-muted">
            {busy ? "Собираем кадр и текст…" : "Здесь появится готовая карточка"}
          </div>
        )}
      </section>
    </main>
  );
}

async function pollJob(id: string): Promise<JobView> {
  for (let i = 0; i < 20; i++) {
    const job = await getJob({ data: id });
    if (!job) throw new Error("Задача потерялась");
    if (job.status === "done" || job.status === "failed") return job;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("Слишком долго. Откройте кабинет — задача сохранится.");
}

async function downloadJob(job: JobView, result: NonNullable<JobView["result"]>) {
  const files: { name: string; data: Uint8Array }[] = [];
  const enc = new TextEncoder();
  files.push({
    name: "seo.txt",
    data: enc.encode(
      `${result.seo.title}\n\n${result.seo.bullets.map((b) => `• ${b}`).join("\n")}\n\n${result.seo.description}\n\n${result.seo.keywords.join(", ")}`,
    ),
  });
  files.push({ name: "card.svg", data: enc.encode(result.svg) });
  if (result.heroUrl) {
    try {
      const res = await fetch(result.heroUrl);
      const buf = new Uint8Array(await res.arrayBuffer());
      files.push({ name: "hero.jpg", data: buf });
    } catch {
      /* skip */
    }
  }
  const blob = zipStore(files);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `kartotseh-${job.id.slice(0, 8)}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}
