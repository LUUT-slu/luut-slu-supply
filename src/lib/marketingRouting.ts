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

export type BrandStyle = string;

export type BrandSurface = "poster" | "display";

export interface BrandStyleDef {
  key: string;
  label: string;
  description: string;
  snippet: string;
  /** Legacy single reference (data URL) — used as fallback when a surface-specific one isn't set. */
  referenceImage?: string;
  /** Optional reference image used purely as a visual-style donor for POSTER generations. */
  referenceImagePoster?: string;
  /** Optional reference image used purely as a visual-style donor for DISPLAY generations. */
  referenceImageDisplay?: string;
  custom?: boolean;
}

export const BUILTIN_BRAND_STYLES: BrandStyleDef[] = [
  { key: "default", label: "Default", description: "No extra brand styling — uses only the selected options.", snippet: "" },
  { key: "tech", label: "Tech", description: "Futuristic, sleek and clean. Cool-toned lighting, modern surfaces.", snippet: "clean technology advertising, futuristic presentation, sleek product positioning" },
  { key: "luxury", label: "Luxury", description: "Premium and elegant. Refined lighting, generous space, polished materials.", snippet: "premium branding, elegant composition, refined lighting, luxury commercial campaign" },
  { key: "streetwear", label: "Streetwear", description: "Urban culture, high contrast, modern editorial energy.", snippet: "urban aesthetic, modern culture-driven branding, high contrast photography" },
  { key: "sports", label: "Sports", description: "Athletic, dynamic angles, vibrant accent lighting, performance energy.", snippet: "athletic energy, dynamic angle, vibrant accent lighting, performance-driven advertising" },
  { key: "minimal", label: "Minimal", description: "Lots of negative space, calm hierarchy, refined typography.", snippet: "minimalist composition, abundant negative space, calm hierarchy, refined typography" },
  { key: "apple", label: "Apple Inspired", description: "Monochrome backdrops, soft key lighting, premium negative space.", snippet: "minimalist composition, monochrome backdrop, premium negative space, soft key lighting, luxury technology advertisement" },
  { key: "nike", label: "Nike Inspired", description: "Bold athletic energy, dynamic angles, motion and vibrancy.", snippet: "athletic energy, dynamic camera angle, vibrant accent lighting, performance-focused advertising, powerful motion" },
];

const CUSTOM_BRAND_STYLES_KEY = "luut.marketing.customBrandStyles.v1";

export function loadCustomBrandStyles(): BrandStyleDef[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_BRAND_STYLES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BrandStyleDef[];
    return Array.isArray(parsed) ? parsed.map((s) => ({ ...s, custom: true })) : [];
  } catch {
    return [];
  }
}

export function saveCustomBrandStyles(styles: BrandStyleDef[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CUSTOM_BRAND_STYLES_KEY,
      JSON.stringify(styles.map((s) => ({ ...s, custom: true }))),
    );
  } catch {
    /* ignore quota */
  }
}

export function getAllBrandStyles(): BrandStyleDef[] {
  return [...BUILTIN_BRAND_STYLES, ...loadCustomBrandStyles()];
}

export function getBrandStyleDef(b: BrandStyle): BrandStyleDef | undefined {
  return getAllBrandStyles().find((s) => s.key === b);
}

// Backwards-compatible label list used by older selectors.
export const BRAND_STYLES: { key: BrandStyle; label: string }[] =
  BUILTIN_BRAND_STYLES.map((b) => ({ key: b.key, label: b.label }));

export function buildBrandStyleSnippet(b: BrandStyle): string {
  return getBrandStyleDef(b)?.snippet || "";
}

/**
 * When a custom brand style has a reference image attached, return a coherent
 * sentence that folds its visual DNA into the unified scene prompt. The sentence
 * is explicit that the reference is style-only — no content carries over.
 */
export function buildBrandStyleReferenceClause(b: BrandStyle): string {
  const def = getBrandStyleDef(b);
  if (!def?.referenceImage) return "";
  const name = def.label || "the saved brand style";
  return `Channel the visual DNA of the attached "${name}" brand-style reference — its color palette, lighting mood, composition rhythm, background treatment, typography feel, and how the subject is positioned — so this same scene looks like it belongs to that campaign. Treat that reference strictly as a style donor: do not copy, reproduce, or borrow any object, product, person, logo, or text from it; only its aesthetic carries over. The product in this image remains the one currently selected, unchanged in identity.`;
}

export function getBrandStyleReferenceImage(b: BrandStyle): string | undefined {
  return getBrandStyleDef(b)?.referenceImage;
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
  realism: DisplayRealism;
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
  // With a reference image, always use nano-banana-pro for true product-identity
  // preservation. Riverflow/Ideogram redesign the product too aggressively.
  if (c.hasReference) return MODEL_REGISTRY.display;
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

// ---------- Scene composition ----------
//
// Rule: every selected option modifies ONE coherent scene. We never concatenate
// option labels. We resolve clauses in priority order
// (product > interaction > human model > environment > style modifiers),
// then suppress clauses that contradict a higher-priority clause.

type RealismKey = DisplayRealism;

const REALISM_QUALIFIER: Record<RealismKey, string> = {
  standard: "Photograph",
  premium: "Premium commercial photograph",
  hyper: "Hyper-realistic photograph",
  luxury: "Luxury campaign photograph",
};

const REALISM_TRAILER: Record<RealismKey, string> = {
  standard: "",
  premium:
    "Refined commercial lighting, polished finish, accurate materials, real shadows.",
  hyper:
    "Natural lighting, real camera depth of field, real textures, real shadows, real materials. No CGI look, no floating objects, no exaggerated textures, no secondary focal points.",
  luxury:
    "High-end editorial lighting, refined palette, restrained composition, premium materials, accurate reflections.",
};

interface SceneContext {
  goal: DisplayGoal;
  style: DisplayStyle;
  background: DisplayBackground;
  realism: DisplayRealism;
  focus: DisplayFocus;
  productTitle: string;
  productCategory?: string;
}

interface SceneInteraction {
  isHuman: boolean;
  isCloseup: boolean;
  // The main "what is happening" clause, placed right after the realism qualifier.
  clause: string;
}

function resolveInteraction(c: SceneContext): SceneInteraction {
  const product = `the ${c.productTitle}`;
  const human = c.goal === "human_model" || c.style === "human";
  const inUse = c.focus === "in_use" || human;
  const closeup =
    c.goal === "product_closeup" || c.focus === "detail" || c.focus === "texture";

  if (human && inUse) {
    return {
      isHuman: true,
      isCloseup: closeup,
      clause: `${closeup ? "tight close-up of " : ""}a person actively wearing, holding, or using ${product}, captured from a distance close enough to keep the product as the primary focus. The model exists only to demonstrate real-world use of ${product} and never becomes the focal point. ${product} must be physically interacted with — never floating, never placed beside the person, never disconnected from the body.`,
    };
  }

  if (closeup) {
    return {
      isHuman: false,
      isCloseup: true,
      clause: `extreme close-up of ${product}, filling 60–80% of the frame, camera close enough to reveal materials, stitching, and surface detail. No wide angle, no secondary subjects.`,
    };
  }

  if (c.goal === "product_hero") {
    return {
      isHuman: false,
      isCloseup: false,
      clause: `hero composition centered on ${product} with dramatic framing. ${product} is the single focal point and occupies most of the frame.`,
    };
  }

  if (c.goal === "lifestyle_product" || c.style === "lifestyle") {
    return {
      isHuman: false,
      isCloseup: false,
      clause: `${product} shown in realistic everyday use within a supporting environment. ${product} remains the primary subject and the environment never competes for attention.`,
    };
  }

  if (c.goal === "packaging_showcase" || c.focus === "packaging") {
    return {
      isHuman: false,
      isCloseup: false,
      clause: `retail packshot of ${product}, packaging filling most of the frame with the label cleanly legible. No distractions.`,
    };
  }

  // Default: product_display / full / hero_angle
  return {
    isHuman: false,
    isCloseup: false,
    clause: `${product} isolated as the sole main subject, occupying most of the frame${c.focus === "hero_angle" ? " from a slightly low dramatic hero angle" : ""}. No distractions, no secondary objects.`,
  };
}

function resolveStyleClause(c: SceneContext, i: SceneInteraction): string {
  // "human" style is already folded into the interaction clause.
  if (c.style === "human") return "";
  switch (c.style) {
    case "studio":
      // Suppress if interaction is already a lifestyle/in-use scene — studio would contradict.
      if (i.isHuman || c.goal === "lifestyle_product") return "";
      return "Professional commercial studio photography setup with controlled lighting and a clean backdrop. The product remains the focal point.";
    case "lifestyle":
      // Already covered if interaction is the lifestyle clause; avoid duplication.
      if (c.goal === "lifestyle_product") return "";
      return "Realistic everyday environment with natural light supporting — never competing with — the product.";
    case "minimal":
      return "Minimalist composition with generous negative space; the product remains the focal point.";
    default:
      return "";
  }
}

function resolveBackgroundClause(c: SceneContext, i: SceneInteraction): string {
  // Suppress backgrounds that contradict the interaction.
  if (i.isHuman) return ""; // human/in-use scenes carry their own environment
  if (c.goal === "lifestyle_product" && (c.background === "solid" || c.background === "gradient" || c.background === "studio")) return "";
  if (c.style === "studio" && c.background === "lifestyle") return "";

  switch (c.background) {
    case "solid":
      return "Clean solid color background.";
    case "gradient":
      return "Soft gradient background.";
    case "studio":
      return "Professional studio backdrop with controlled lighting.";
    case "lifestyle":
      return "Lifestyle scene background that complements the product.";
    case "transparent":
      return "Pure white background suitable for transparent cut-out.";
    default:
      return "";
  }
}

/**
 * composeScene assembles ONE coherent scene paragraph from all selections.
 * Order: realism qualifier + interaction clause -> style clause -> background
 * clause -> realism trailer. Contradictory clauses are suppressed.
 */
function composeScene(c: SceneContext): string {
  const interaction = resolveInteraction(c);
  const qualifier = REALISM_QUALIFIER[c.realism];
  const productSuffix = c.productCategory ? ` (${c.productCategory})` : "";

  // Lead sentence: realism + interaction + product identity.
  const lead = `${qualifier} — ${interaction.clause.replace(
    `the ${c.productTitle}`,
    `the ${c.productTitle}${productSuffix}`,
  )}`;

  const parts: string[] = [lead];
  const styleClause = resolveStyleClause(c, interaction);
  if (styleClause) parts.push(styleClause);
  const bgClause = resolveBackgroundClause(c, interaction);
  if (bgClause) parts.push(bgClause);
  const trailer = REALISM_TRAILER[c.realism];
  if (trailer) parts.push(trailer);

  return parts.join(" ");
}

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

  // Product scene on the poster — composed coherently, product as primary subject.
  const scene = composeScene({
    goal: "product_hero",
    style: "studio",
    background: "gradient",
    realism: c.realism,
    focus: "hero_angle",
    productTitle: c.productTitle,
  });
  parts.push(`Product imagery on the poster: ${scene}`);


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
  const brandRefClause = buildBrandStyleReferenceClause(brand);
  if (brandRefClause) parts.push(brandRefClause);

  if (c.hasReference) parts.push(REF_PRESERVATION);
  if (c.notes && c.notes.trim()) parts.push(c.notes.trim());

  return parts.join(" ");
}

export function buildDisplayPrompt(c: DisplayControls, brand: BrandStyle): string {
  const scene = composeScene({
    goal: c.goal,
    style: c.style,
    background: c.background,
    realism: c.realism,
    focus: c.focus,
    productTitle: c.productTitle,
    productCategory: c.productCategory,
  });

  const parts: string[] = [scene];
  parts.push(`Compose strictly in a ${c.aspectRatio} aspect ratio frame.`);

  const brandSnippet = buildBrandStyleSnippet(brand);
  if (brandSnippet) parts.push(brandSnippet + ".");
  const brandRefClause = buildBrandStyleReferenceClause(brand);
  if (brandRefClause) parts.push(brandRefClause);

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
