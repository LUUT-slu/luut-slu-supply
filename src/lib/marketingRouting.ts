// Marketing Studio routing engine.
// The user picks a marketing TASK — never a model. routeModel() decides.
// buildPrompt() assembles base + brand-style + goal + auto-enhancements +
// reference-preservation + user notes into the final string sent to the model.

export type ModelKey = "poster" | "display" | "closeup" | "fallback";

export interface ModelChoice {
  key: ModelKey;
  model: string;
  provider: "replicate";
  reason: string;
}

export const MODEL_REGISTRY: Record<ModelKey, ModelChoice> = {
  poster: {
    key: "poster",
    model: "ideogram-ai/ideogram-v3-quality",
    provider: "replicate",
    reason: "best typography, posters, flyers, social marketing graphics",
  },
  display: {
    key: "display",
    model: "google/nano-banana-pro",
    provider: "replicate",
    reason: "image-to-image product photography that preserves reference identity",
  },
  closeup: {
    key: "closeup",
    model: "sourceful/riverflow-2.0-pro",
    provider: "replicate",
    reason: "best macro photography, texture preservation, feature details",
  },
  fallback: {
    key: "fallback",
    model: "google/nano-banana-pro",
    provider: "replicate",
    reason: "best general purpose image generation",
  },
};

// ---------- Brand styles ----------

export type BrandStyle =
  | "default"
  | "tech"
  | "luxury"
  | "streetwear"
  | "sports"
  | "minimal"
  | "apple"
  | "nike";

export const BRAND_STYLES: { key: BrandStyle; label: string }[] = [
  { key: "default", label: "Default" },
  { key: "tech", label: "Tech" },
  { key: "luxury", label: "Luxury" },
  { key: "streetwear", label: "Streetwear" },
  { key: "sports", label: "Sports" },
  { key: "minimal", label: "Minimal" },
  { key: "apple", label: "Apple Inspired" },
  { key: "nike", label: "Nike Inspired" },
];

export function buildBrandStyleSnippet(b: BrandStyle): string {
  switch (b) {
    case "tech":
      return "clean technology advertising, futuristic presentation, sleek product positioning";
    case "luxury":
      return "premium branding, elegant composition, refined lighting, luxury commercial campaign";
    case "streetwear":
      return "urban aesthetic, modern culture-driven branding, high contrast photography";
    case "sports":
      return "athletic energy, dynamic angle, vibrant accent lighting, performance-driven advertising";
    case "minimal":
      return "minimalist composition, abundant negative space, calm hierarchy, refined typography";
    case "apple":
      return "minimalist composition, monochrome backdrop, premium negative space, soft key lighting, luxury technology advertisement";
    case "nike":
      return "athletic energy, dynamic camera angle, vibrant accent lighting, performance-focused advertising, powerful motion";
    case "default":
    default:
      return "";
  }
}

// ---------- Tasks ----------

export type PosterCampaign =
  | "sale"
  | "promotion"
  | "new_arrival"
  | "limited_drop"
  | "clearance"
  | "brand_awareness"
  | "event";

export type PosterStyle = "clean" | "luxury" | "bold" | "hype" | "modern" | "minimal";

export type DisplayGoal =
  | "product_display"
  | "product_closeup"
  | "human_model"
  | "lifestyle_product"
  | "product_hero"
  | "packaging_showcase";

export type DisplayStyle = "studio" | "lifestyle" | "minimal" | "human";

export type DisplayBackground =
  | "solid"
  | "gradient"
  | "studio"
  | "lifestyle"
  | "transparent";

export type DisplayRealism = "standard" | "premium" | "hyper" | "luxury";

export type DisplayFocus =
  | "full"
  | "detail"
  | "texture"
  | "packaging"
  | "in_use"
  | "hero_angle";

export type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9" | "3:4";

export interface PosterControls {
  productTitle: string;
  productPrice?: string;
  campaign: PosterCampaign;
  style: PosterStyle;
  aspectRatio: AspectRatio;
  headline?: string;
  subheadline?: string;
  priceText?: string;
  ctaText?: string;
  brandName?: string;
  meetupText?: string;
  notes?: string;
  hasReference: boolean;
}

export interface DisplayControls {
  productTitle: string;
  productCategory?: string;
  goal: DisplayGoal;
  style: DisplayStyle;
  background: DisplayBackground;
  realism: DisplayRealism;
  focus: DisplayFocus;
  aspectRatio: AspectRatio;
  notes?: string;
  hasReference: boolean;
}

// ---------- Routing ----------

export function routeForPoster(c: PosterControls): ModelChoice {
  // When a reference image is provided, prefer nano-banana-pro which actually
  // preserves the product identity (image-to-image). Ideogram's style_reference
  // only transfers aesthetic, not product identity.
  if (c.hasReference) return MODEL_REGISTRY.display;
  return MODEL_REGISTRY.poster;
}

export function routeForDisplay(c: DisplayControls): ModelChoice {
  if (c.goal === "product_closeup" || c.focus === "detail" || c.focus === "texture") {
    return MODEL_REGISTRY.closeup;
  }
  switch (c.goal) {
    case "product_display":
    case "product_hero":
    case "lifestyle_product":
    case "packaging_showcase":
    case "human_model":
      return MODEL_REGISTRY.display;
    default:
      return MODEL_REGISTRY.fallback;
  }
}

// ---------- Prompt enhancement ----------

const ENHANCE_REALISM: Record<DisplayRealism, string> = {
  standard: "",
  premium: "premium commercial photography, refined lighting, polished finish",
  hyper:
    "hyper realistic product photography, commercial advertising quality, ultra detailed textures, premium lighting, professional product photography, realistic reflections, 8k detail, studio lighting",
  luxury:
    "luxury advertising campaign, premium brand aesthetic, high-end commercial photography, minimal composition, elegant lighting, luxury product presentation",
};

const ENHANCE_GOAL: Record<DisplayGoal, string> = {
  product_display: "",
  product_hero: "hero product composition, dramatic framing, marketing campaign hero image",
  lifestyle_product:
    "real world environment, natural lighting, lifestyle photography, authentic scene",
  packaging_showcase:
    "premium packaging presentation, accurate label rendering, retail packshot quality",
  human_model:
    "commercial lifestyle photography, realistic human interaction, professional model, authentic product usage",
  product_closeup:
    "macro photography, product detail focus, texture preservation, ultra sharp detail, close-up composition",
};

const ENHANCE_STYLE: Record<DisplayStyle, string> = {
  studio: "commercial studio photography, seamless backdrop, premium product presentation",
  lifestyle: "lifestyle environment, natural light, authentic context",
  minimal: "minimalist composition, luxury product display, premium negative space",
  human: "real human model, professional fashion lighting, editorial composition",
};

const ENHANCE_BG: Record<DisplayBackground, string> = {
  solid: "clean solid color background",
  gradient: "soft gradient background",
  studio: "professional studio backdrop with controlled lighting",
  lifestyle: "lifestyle scene background that complements the product",
  transparent: "pure white background suitable for transparent cut-out",
};

const ENHANCE_FOCUS: Record<DisplayFocus, string> = {
  full: "full product visible in frame",
  detail: "detail-focused crop on the most distinctive feature",
  texture: "texture-emphasis composition revealing material surface",
  packaging: "packaging-led composition",
  in_use: "product shown in use",
  hero_angle: "dramatic hero angle, slightly low camera",
};

const POSTER_CAMPAIGN_LABEL: Record<PosterCampaign, string> = {
  sale: "retail sale poster",
  promotion: "product promotion flyer",
  new_arrival: "new arrival announcement",
  limited_drop: "limited drop streetwear flyer",
  clearance: "clearance sale poster",
  brand_awareness: "brand awareness campaign graphic",
  event: "event promotion poster",
};

const POSTER_STYLE_HINT: Record<PosterStyle, string> = {
  clean: "clean modern editorial layout, refined typography, generous whitespace",
  luxury: "luxury campaign aesthetic, elegant serif typography, refined palette",
  bold: "bold high-contrast layout, oversized condensed type, brutalist scale",
  hype: "streetwear hype drop, gritty urban backdrop, stencil graffiti energy",
  modern: "modern minimal design, geometric layout, contemporary sans-serif",
  minimal: "minimalist poster, single focal product, restrained palette",
};

const REF_PRESERVATION =
  "PRESERVE the product exactly as shown in the reference image — same identity, shape, color, branding, logos, materials, and proportions. Do not redesign, recolor, or substitute the product. Enhance only the surrounding presentation, scene, lighting, and composition.";

// ---------- Prompt builders ----------

export function buildPosterPrompt(c: PosterControls, brand: BrandStyle): string {
  const parts: string[] = [];
  parts.push(
    `${POSTER_CAMPAIGN_LABEL[c.campaign]} for "${c.productTitle}", ${POSTER_STYLE_HINT[c.style]}.`,
  );
  parts.push(`Compose strictly in a ${c.aspectRatio} aspect ratio frame.`);

  const textBits: string[] = [];
  if (c.headline) textBits.push(`Headline: "${c.headline}"`);
  if (c.subheadline) textBits.push(`Subheadline: "${c.subheadline}"`);
  if (c.priceText) textBits.push(`Price: "${c.priceText}"`);
  if (c.ctaText) textBits.push(`CTA button: "${c.ctaText}"`);
  if (textBits.length) {
    parts.push(
      `Render the following text cleanly and legibly on the poster, with clear hierarchy: ${textBits.join("; ")}.`,
    );
  }
  if (c.brandName) parts.push(`Brand wordmark: "${c.brandName}".`);
  if (c.meetupText) parts.push(`Footer detail: "${c.meetupText}".`);

  const brandSnippet = buildBrandStyleSnippet(brand);
  if (brandSnippet) parts.push(brandSnippet + ".");

  if (c.hasReference) parts.push(REF_PRESERVATION);
  if (c.notes && c.notes.trim()) parts.push(c.notes.trim());

  return parts.join(" ");
}

export function buildDisplayPrompt(c: DisplayControls, brand: BrandStyle): string {
  const parts: string[] = [];
  parts.push(
    `Commercial product image of ${c.productTitle}${c.productCategory ? ` (${c.productCategory})` : ""}.`,
  );
  parts.push(ENHANCE_GOAL[c.goal]);
  parts.push(ENHANCE_STYLE[c.style]);
  parts.push(ENHANCE_BG[c.background]);
  parts.push(ENHANCE_FOCUS[c.focus]);
  const realism = ENHANCE_REALISM[c.realism];
  if (realism) parts.push(realism);
  parts.push(`Compose strictly in a ${c.aspectRatio} aspect ratio frame.`);

  const brandSnippet = buildBrandStyleSnippet(brand);
  if (brandSnippet) parts.push(brandSnippet);

  if (c.hasReference) parts.push(REF_PRESERVATION);
  if (c.notes && c.notes.trim()) parts.push(c.notes.trim());

  return parts.filter(Boolean).join(" ");
}

// ---------- Presets ----------

export interface PosterPreset {
  id: string;
  label: string;
  apply: Partial<PosterControls>;
}

export const POSTER_PRESETS: PosterPreset[] = [
  { id: "flash_sale",   label: "Flash Sale",      apply: { campaign: "sale", style: "bold", headline: "FLASH SALE", ctaText: "Shop Now" } },
  { id: "new_arrival",  label: "New Arrival",     apply: { campaign: "new_arrival", style: "clean", headline: "JUST IN", ctaText: "Discover" } },
  { id: "limited_drop", label: "Limited Drop",    apply: { campaign: "limited_drop", style: "hype", headline: "LIMITED DROP", ctaText: "Cop Now" } },
  { id: "black_friday", label: "Black Friday",    apply: { campaign: "sale", style: "bold", headline: "BLACK FRIDAY", ctaText: "Save Big" } },
  { id: "clearance",    label: "Clearance",       apply: { campaign: "clearance", style: "bold", headline: "CLEARANCE", ctaText: "Final Sale" } },
  { id: "brand",        label: "Brand Awareness", apply: { campaign: "brand_awareness", style: "minimal" } },
];

export interface DisplayPreset {
  id: string;
  label: string;
  apply: Partial<DisplayControls>;
}

export const DISPLAY_PRESETS: DisplayPreset[] = [
  { id: "amazon",     label: "Amazon Listing",     apply: { goal: "product_display", style: "studio", background: "solid", realism: "hyper", focus: "full", aspectRatio: "1:1" } },
  { id: "website",    label: "Website Hero",       apply: { goal: "product_hero", style: "studio", background: "gradient", realism: "premium", focus: "hero_angle", aspectRatio: "16:9" } },
  { id: "luxury",     label: "Luxury Product",     apply: { goal: "product_display", style: "minimal", background: "gradient", realism: "luxury", focus: "full", aspectRatio: "4:5" } },
  { id: "instagram",  label: "Instagram Product",  apply: { goal: "lifestyle_product", style: "lifestyle", background: "lifestyle", realism: "premium", focus: "in_use", aspectRatio: "4:5" } },
  { id: "closeup",    label: "Product Closeup",    apply: { goal: "product_closeup", style: "studio", background: "solid", realism: "hyper", focus: "detail", aspectRatio: "1:1" } },
  { id: "packaging",  label: "Packaging Showcase", apply: { goal: "packaging_showcase", style: "studio", background: "studio", realism: "premium", focus: "packaging", aspectRatio: "1:1" } },
];

// ---------- Public route helpers ----------

export function previewPosterFinal(c: PosterControls, brand: BrandStyle) {
  const route = routeForPoster(c);
  const prompt = buildPosterPrompt(c, brand);
  return { route, prompt };
}

export function previewDisplayFinal(c: DisplayControls, brand: BrandStyle) {
  const route = routeForDisplay(c);
  const prompt = buildDisplayPrompt(c, brand);
  return { route, prompt };
}
