// Shared types & metadata for Marketing Studio "Poster Types".
// A poster type defines what the studio is generating + how the auto-source behaves.

export type PosterType =
  | "single"
  | "bestsellers"
  | "new-arrivals"
  | "restocked"
  | "low-stock"
  | "promotions";

export interface PosterTypeMeta {
  key: PosterType;
  label: string;
  hint: string;
  headline: string; // big headline shown on the multi-product poster
  badge: string | null; // per-tile badge (NEW / SALE / ...)
  defaultUrgency: string;
  defaultCta?: string;
}

export const POSTER_TYPES: PosterTypeMeta[] = [
  {
    key: "single",
    label: "Single Promo",
    hint: "Spotlight one product",
    headline: "",
    badge: null,
    defaultUrgency: "NEW IN",
  },
  {
    key: "bestsellers",
    label: "Best Sellers",
    hint: "Top sellers this week",
    headline: "TOP PICKS THIS WEEK",
    badge: "BEST SELLER",
    defaultUrgency: "MOST WANTED",
    defaultCta: "SHOP THE TOP PICKS",
  },
  {
    key: "new-arrivals",
    label: "New Arrivals",
    hint: "Just dropped",
    headline: "JUST DROPPED",
    badge: "NEW",
    defaultUrgency: "FRESH DROP",
    defaultCta: "SHOP NEW ARRIVALS",
  },
  {
    key: "restocked",
    label: "Restocked",
    hint: "Back in stock",
    headline: "BACK IN STOCK",
    badge: "RESTOCKED",
    defaultUrgency: "BACK BY DEMAND",
    defaultCta: "GRAB IT BEFORE IT'S GONE",
  },
  {
    key: "low-stock",
    label: "Almost Gone",
    hint: "Low stock alert",
    headline: "ALMOST GONE",
    badge: "ALMOST GONE",
    defaultUrgency: "LIMITED STOCK",
    defaultCta: "DON'T MISS OUT",
  },
  {
    key: "promotions",
    label: "Promotions",
    hint: "Active sale items",
    headline: "ON SALE NOW",
    badge: "SALE",
    defaultUrgency: "LIMITED-TIME OFFER",
    defaultCta: "SHOP THE SALE",
  },
];

export function getPosterTypeMeta(key: PosterType): PosterTypeMeta {
  return POSTER_TYPES.find((p) => p.key === key) || POSTER_TYPES[0];
}

// Unified shape used by ProductSourceCard + MultiProductTemplate
export interface MarketingProduct {
  id: string;
  title: string;
  imageUrl?: string;
  price?: string; // formatted amount, no currency
  badge?: string;
  hint?: string; // small secondary line: "12 sold" / "2 left" / "20% OFF"
}
