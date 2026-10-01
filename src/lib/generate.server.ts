import { getSql } from "@/lib/db";
import { CREDITS_PER_CARD } from "@/lib/catalog";
import { newId } from "@/lib/ids";
import { logOps } from "@/lib/ops.server";
import { ensureWallet } from "@/lib/wallet.server";
import type { GenerateInput, JobResult, JobView, Marketplace, SeoCopy } from "@/lib/generate";

type JobDb = {
  id: string;
  request_id: string;
  status: string;
  marketplace: string;
  product_title: string;
  product_notes: string;
  category: string;
  result_json: string | null;
  error: string | null;
  credits_spent: number;
  created_at: unknown;
};

function toView(row: JobDb, withResult: boolean): JobView {
  let result: JobResult | null = null;
  if (withResult && row.result_json) {
    try {
      result = JSON.parse(row.result_json) as JobResult;
    } catch {
      result = null;
    }
  } else if (row.result_json) {
    try {
      const parsed = JSON.parse(row.result_json) as JobResult;
      result = { seo: parsed.seo, svg: "", heroUrl: parsed.heroUrl };
    } catch {
      result = null;
    }
  }
  return {
    id: row.id,
    requestId: row.request_id,
    status: row.status as JobView["status"],
    marketplace: row.marketplace as Marketplace,
    productTitle: row.product_title,
    productNotes: row.product_notes,
    category: row.category,
    result,
    error: row.error,
    creditsSpent: row.credits_spent,
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

export async function listJobsForUser(userId: string, withResult: boolean): Promise<JobView[]> {
  const sql = await getSql();
  const rows = await sql<JobDb>`
    select id, request_id, status, marketplace, product_title, product_notes, category,
           result_json, error, credits_spent, created_at
    from generation_jobs
    where user_id = ${userId}
    order by created_at desc
    limit 24
  `;
  return rows.map((r) => toView(r, withResult));
}

export async function getJobForUser(userId: string, id: string): Promise<JobView | null> {
  const sql = await getSql();
  const rows = await sql<JobDb>`
    select id, request_id, status, marketplace, product_title, product_notes, category,
           result_json, error, credits_spent, created_at
    from generation_jobs
    where id = ${id} and user_id = ${userId}
    limit 1
  `;
  return rows[0] ? toView(rows[0], true) : null;
}

export async function runGeneration(userId: string, input: GenerateInput): Promise<JobView> {
  await ensureWallet(userId);
  const sql = await getSql();

  const dup = await sql<JobDb>`
    select id, request_id, status, marketplace, product_title, product_notes, category,
           result_json, error, credits_spent, created_at
    from generation_jobs
    where user_id = ${userId} and request_id = ${input.requestId}
    limit 1
  `;
  if (dup[0]) return toView(dup[0], true);

  const recent = await sql<{ n: number }>`
    select count(*)::int as n from generation_jobs
    where user_id = ${userId} and created_at > now() - interval '10 minutes'
  `;
  if ((recent[0]?.n ?? 0) >= 12) {
    throw new Error("Слишком много генераций подряд. Подождите немного.");
  }

  const jobId = newId();
  const cost = CREDITS_PER_CARD;

  try {
    await sql`
      insert into generation_jobs (
        id, user_id, request_id, status, marketplace, product_title, product_notes, category, source_image_data, credits_spent
      ) values (
        ${jobId}, ${userId}, ${input.requestId}, 'queued', ${input.marketplace}, ${input.productTitle},
        ${input.productNotes}, ${input.category}, ${input.sourceImageData ?? null}, ${cost}
      )
    `;
  } catch {
    const again = await sql<JobDb>`
      select id, request_id, status, marketplace, product_title, product_notes, category,
             result_json, error, credits_spent, created_at
      from generation_jobs
      where user_id = ${userId} and request_id = ${input.requestId}
      limit 1
    `;
    if (again[0]) return toView(again[0], true);
    throw new Error("Не удалось поставить задачу");
  }

  const charged = await sql<{ balance: number }>`
    with moved as (
      update wallets
      set credits = credits - ${cost}, updated_at = now()
      where user_id = ${userId} and credits >= ${cost}
      returning credits as balance
    ),
    led as (
      insert into credit_ledger (id, user_id, delta, reason, ref_type, ref_id)
      select ${newId()}, ${userId}, ${-cost}, 'generation', 'job', ${jobId}
      from moved
      returning id
    )
    select moved.balance from moved join led on true
  `;
  if (!charged[0]) {
    await sql`
      update generation_jobs
      set status = 'failed', error = 'Недостаточно кредитов', updated_at = now()
      where id = ${jobId} and user_id = ${userId}
    `;
    throw new Error("Недостаточно кредитов. Купите пакет в кабинете.");
  }

  await sql`update generation_jobs set status = 'running', updated_at = now() where id = ${jobId}`;

  try {
    const result = await buildCard(input);
    const json = JSON.stringify(result);
    await sql`
      update generation_jobs
      set status = 'done', result_json = ${json}, error = null, updated_at = now()
      where id = ${jobId} and user_id = ${userId}
    `;
    return (await getJobForUser(userId, jobId))!;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Сбой генерации";
    await refundJob(userId, jobId, cost);
    await sql`
      update generation_jobs
      set status = 'failed', error = ${message.slice(0, 280)}, updated_at = now()
      where id = ${jobId} and user_id = ${userId}
    `;
    await logOps("warn", "generation_fail", message, { jobId, userId });
    return (await getJobForUser(userId, jobId))!;
  }
}

async function refundJob(userId: string, jobId: string, cost: number): Promise<void> {
  const sql = await getSql();
  await sql`
    with led as (
      insert into credit_ledger (id, user_id, delta, reason, ref_type, ref_id)
      values (${newId()}, ${userId}, ${cost}, 'refund', 'job', ${jobId})
      on conflict (user_id, reason, ref_id) do nothing
      returning delta
    )
    update wallets
    set credits = credits + coalesce((select delta from led), 0), updated_at = now()
    where user_id = ${userId}
  `;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """);
}

function wrapLines(text: string, max = 28, lines = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > max && cur) {
      out.push(cur);
      cur = w;
      if (out.length === lines) break;
    } else cur = next;
  }
  if (out.length < lines && cur) out.push(cur);
  return out.slice(0, lines);
}

export function composeCardSvg(input: {
  marketplace: Marketplace;
  title: string;
  category: string;
  bullets: string[];
  photo?: string | null;
}): string {
  const market = input.marketplace === "ozon" ? "OZON" : "WILDBERRIES";
  const titleLines = wrapLines(input.title, 22, 3);
  const bullets = (input.bullets.length ? input.bullets : ["Готово к витрине", "Состав и факты", "Продающий акцент"]).slice(0, 4);
  const photo = input.photo && input.photo.startsWith("data:image")
    ? `<image href="${escapeXml(input.photo)}" x="64" y="220" width="952" height="720" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect x="64" y="220" width="952" height="720" fill="#E7DFD2"/>
       <text x="540" y="590" text-anchor="middle" font-size="22" fill="#8A8175" font-family="Georgia, serif">фото товара</text>`;

  const bulletBlocks = bullets
    .map((b, i) => {
      const y = 980 + i * 92;
      const lines = wrapLines(b, 36, 2);
      const t = lines
        .map(
          (ln, li) =>
            `<text x="150" y="${y + 28 + li * 28}" font-size="22" fill="#F7F1E8" font-family="Georgia, serif">${escapeXml(ln)}</text>`,
        )
        .join("");
      return `<rect x="64" y="${y}" width="952" height="80" rx="8" fill="#2A241F"/>
        <rect x="64" y="${y}" width="10" height="80" fill="#2F4A43"/>
        ${t}`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440" viewBox="0 0 1080 1440">
  <rect width="1080" height="1440" fill="#F7F1E8"/>
  <rect x="0" y="0" width="1080" height="48" fill="#1A1714"/>
  <text x="64" y="32" fill="#F7F1E8" font-size="16" font-family="ui-sans-serif, system-ui" letter-spacing="4">${market}</text>
  <text x="1016" y="32" text-anchor="end" fill="#C4B8A8" font-size="14" font-family="ui-sans-serif, system-ui">КАРТОЦЕХ</text>
  ${titleLines
    .map(
      (ln, i) =>
        `<text x="64" y="${100 + i * 40}" font-size="34" fill="#1A1714" font-family="Georgia, serif">${escapeXml(ln)}</text>`,
    )
    .join("")}
  <text x="64" y="200" fill="#6F675C" font-size="16" font-family="ui-sans-serif, system-ui">${escapeXml(input.category || "карточка товара")}</text>
  ${photo}
  ${bulletBlocks}
  <text x="64" y="1408" fill="#8A8175" font-size="14" font-family="ui-sans-serif, system-ui">Инфографика собрана в цехе · 1080×1440</text>
</svg>`;
}

function parseSeo(text: string, fallbackTitle: string): SeoCopy {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
  try {
    const json = JSON.parse(cleaned) as Partial<SeoCopy>;
    const bullets = Array.isArray(json.bullets)
      ? json.bullets.map((b) => String(b).slice(0, 80)).filter(Boolean).slice(0, 6)
      : [];
    return {
      title: String(json.title || fallbackTitle).slice(0, 120),
      bullets: bullets.length ? bullets : ["Ключевая выгода", "Состав / материал", "Для кого", "Почему берут"],
      description: String(json.description || "").slice(0, 1200),
      keywords: Array.isArray(json.keywords) ? json.keywords.map((k) => String(k)).slice(0, 12) : [],
    };
  } catch {
    return {
      title: fallbackTitle,
      bullets: ["Ключевая выгода", "Характеристика", "Для кого", "УТП"],
      description: cleaned.slice(0, 600),
      keywords: [],
    };
  }
}

async function buildCard(input: GenerateInput): Promise<JobResult> {
  const apiKey = process.env.XAI_API_KEY;
  let seo: SeoCopy = {
    title: input.productTitle,
    bullets: input.productNotes
      ? input.productNotes.split(/[;\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 4)
      : ["Готовый визуал для витрины", "Продающий заголовок", "Факты о товаре"],
    description: input.productNotes || input.productTitle,
    keywords: input.category ? [input.category] : [],
  };
  let heroUrl: string | undefined;

  if (apiKey) {
    const market = input.marketplace === "ozon" ? "Ozon" : "Wildberries";
    const content: unknown[] = [
      {
        type: "text",
        text: `Ты копирайтер карточек ${market}. Верни ТОЛЬКО JSON:
{"title":"...","bullets":["...","...","...","..."],"description":"...","keywords":["..."]}
Товар: ${input.productTitle}
Категория: ${input.category || "не указана"}
Заметки: ${input.productNotes || "нет"}
Заголовок до 100 символов, 4 буллета выгоды (до 60 символов), описание 400-700 символов, 8 ключевых слов. Русский язык, без воды и клише «инновационный».`,
      },
    ];
    if (input.sourceImageData) {
      content.unshift({ type: "image_url", image_url: { url: input.sourceImageData } });
    }
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        messages: [{ role: "user", content }],
        max_tokens: 700,
        temperature: 0.4,
      }),
    });
    if (res.ok) {
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = body.choices?.[0]?.message?.content ?? "";
      if (text) seo = parseSeo(text, input.productTitle);
    }

    heroUrl = await maybeImagine(apiKey, input, seo);
  }

  const svg = composeCardSvg({
    marketplace: input.marketplace,
    title: seo.title,
    category: input.category,
    bullets: seo.bullets,
    photo: input.sourceImageData,
  });

  return { seo, heroUrl, svg };
}

async function maybeImagine(apiKey: string, input: GenerateInput, seo: SeoCopy): Promise<string | undefined> {
  const prompt = `Product photography infographic for a marketplace listing, clean studio, no logos of Wildberries or Ozon, no watermarks, no text overlay. Subject: ${input.productTitle}. ${seo.bullets.join("; ")}. Premium catalog photo, 3:4, kraft-paper set, truthful materials.`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 18000);
  try {
    if (input.sourceImageData) {
      const edit = await fetch("https://api.x.ai/v1/images/edits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: ac.signal,
        body: JSON.stringify({
          model: "grok-imagine-image",
          prompt,
          image: { url: input.sourceImageData, type: "image_url" },
        }),
      });
      if (edit.ok) {
        const body = (await edit.json()) as { data?: { url?: string }[]; url?: string };
        const url = body.data?.[0]?.url ?? body.url;
        if (url) return url;
      }
    }
    const gen = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: ac.signal,
      body: JSON.stringify({
        model: "grok-imagine-image",
        prompt,
        n: 1,
        resolution: "1k",
      }),
    });
    if (gen.ok) {
      const body = (await gen.json()) as { data?: { url?: string }[] };
      return body.data?.[0]?.url;
    }
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
  return undefined;
}
