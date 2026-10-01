import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export type Marketplace = "wb" | "ozon";

export type SeoCopy = {
  title: string;
  bullets: string[];
  description: string;
  keywords: string[];
};

export type JobResult = {
  seo: SeoCopy;
  heroUrl?: string;
  svg: string;
};

export type JobView = {
  id: string;
  requestId: string;
  status: "queued" | "running" | "done" | "failed";
  marketplace: Marketplace;
  productTitle: string;
  productNotes: string;
  category: string;
  result: JobResult | null;
  error: string | null;
  creditsSpent: number;
  createdAt: string;
};

export type GenerateInput = {
  requestId: string;
  marketplace: Marketplace;
  productTitle: string;
  productNotes: string;
  category: string;
  sourceImageData?: string | null;
};

export const startGeneration = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: GenerateInput) => {
    const title = input.productTitle?.trim() ?? "";
    if (title.length < 2 || title.length > 140) throw new Error("Укажите название товара");
    if (input.marketplace !== "wb" && input.marketplace !== "ozon") throw new Error("Площадка");
    const requestId = input.requestId?.trim();
    if (!requestId || requestId.length < 8) throw new Error("Bad request id");
    const image = input.sourceImageData ?? null;
    if (image && image.length > 900_000) throw new Error("Фото слишком большое — до 700 КБ");
    return {
      requestId,
      marketplace: input.marketplace,
      productTitle: title,
      productNotes: (input.productNotes ?? "").trim().slice(0, 1200),
      category: (input.category ?? "").trim().slice(0, 80),
      sourceImageData: image,
    };
  })
  .handler(async ({ context, data }) => {
    const { runGeneration } = await import("@/lib/generate.server");
    return runGeneration(context.userId, data);
  });

export const listJobs = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listJobsForUser } = await import("@/lib/generate.server");
    return listJobsForUser(context.userId, false);
  });

export const getJob = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const { getJobForUser } = await import("@/lib/generate.server");
    return getJobForUser(context.userId, id);
  });
