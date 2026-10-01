/** Assumed COGS of one generated card: SEO (grok-4.5) + 1 Imagine call + storage. */
export const UNIT_COST_RUB = 18;

/** SBP / QR acquiring fee used in margin math (ЮKassa СБП ~0.4–0.7%). */
export const SBP_FEE_RATE = 0.007;

export const SIGNUP_BONUS_CREDITS = 3;
export const CREDITS_PER_CARD = 1;

export type PackId = "proba" | "smena" | "tseh";

export type CreditPack = {
  id: PackId;
  name: string;
  blurb: string;
  credits: number;
  priceRub: number;
  popular?: boolean;
};

export const PACKS: readonly CreditPack[] = [
  {
    id: "proba",
    name: "Проба",
    blurb: "Пять карточек, чтобы сверить цех с вашей нишей",
    credits: 5,
    priceRub: 290,
  },
  {
    id: "smena",
    name: "Смена",
    blurb: "Пачка на запуск витрины",
    credits: 20,
    priceRub: 990,
    popular: true,
  },
  {
    id: "tseh",
    name: "Цех",
    blurb: "Для селлера с постоянным потоком SKU",
    credits: 50,
    priceRub: 2290,
  },
] as const;

export function packById(id: string): CreditPack | undefined {
  return PACKS.find((p) => p.id === id);
}

export function packMargin(pack: CreditPack): number {
  const cogs = pack.credits * UNIT_COST_RUB + pack.priceRub * SBP_FEE_RATE;
  return (pack.priceRub - cogs) / pack.priceRub;
}

export function assertPackMargins(): void {
  for (const pack of PACKS) {
    if (packMargin(pack) + 1e-9 < 0.6) {
      throw new Error(`Pack ${pack.id} margin ${(packMargin(pack) * 100).toFixed(1)}% < 60%`);
    }
  }
}

export function rubToKopecks(rub: number): number {
  return Math.round(rub * 100);
}

export function kopecksToYooValue(kopecks: number): string {
  return (kopecks / 100).toFixed(2);
}

export type PayMethod = "sbp" | "qr";

export const PAY_METHODS: { id: PayMethod; label: string; hint: string }[] = [
  { id: "sbp", label: "СБП", hint: "Оплата в приложении банка" },
  { id: "qr", label: "QR-код", hint: "Сканируйте камерой банка" },
];
