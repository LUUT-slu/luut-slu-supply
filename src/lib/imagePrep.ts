// Client-side image preparation utilities for Marketing Studio.
// These are POSTER-aspect helpers (output matches the final poster format).
// For container-aspect framing (preview = export, no further crop), use
// frameProduct from @/lib/imageFraming.

import type { TemplateFormat } from "@/components/marketing/templates";
import {
  detectContentBounds,
  sampleCornerColor,
} from "@/lib/imageFraming";

const ASPECT: Record<TemplateFormat, number> = {
  story: 9 / 16,
  post: 1,
  ad: 1200 / 628,
  portrait: 4 / 5,
};

const OUTPUT_LONG_EDGE = 1400;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

function makeCanvas(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas context not available");
  return { canvas, ctx };
}

function targetSize(format: TemplateFormat): { w: number; h: number } {
  const ratio = ASPECT[format];
  if (ratio >= 1) {
    return { w: OUTPUT_LONG_EDGE, h: Math.round(OUTPUT_LONG_EDGE / ratio) };
  }
  return { w: Math.round(OUTPUT_LONG_EDGE * ratio), h: OUTPUT_LONG_EDGE };
}

/**
 * Auto Fit (poster-aspect): centered product, never stretched, sampled
 * background fill, 12% safe margin. Primarily kept for multi-product tile
 * mode and full-bleed exports. For single-product preview, use frameProduct.
 */
export async function autoFitProduct(
  url: string,
  format: TemplateFormat,
): Promise<string> {
  const img = await loadImage(url);
  const bounds = detectContentBounds(img);
  const { w: tw, h: th } = targetSize(format);

  const { canvas, ctx } = makeCanvas(tw, th);
  const { r, g, b } = sampleCornerColor(img);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, tw, th);

  const safeW = tw * 0.76;
  const safeH = th * 0.76;
  const fit = Math.min(safeW / bounds.w, safeH / bounds.h);
  const dw = bounds.w * fit;
  const dh = bounds.h * fit;
  const dx = (tw - dw) / 2;
  const dy = (th - dh) / 2;

  ctx.drawImage(img, bounds.x, bounds.y, bounds.w, bounds.h, dx, dy, dw, dh);
  return canvas.toDataURL("image/png");
}

/**
 * Smart Reframe: largest aspect-correct crop that still contains the entire
 * product + 8% breathing room. If the source can't fully contain the
 * subject at target aspect, falls back to letterboxing onto a clean canvas.
 */
export async function smartReframe(
  url: string,
  format: TemplateFormat,
): Promise<string> {
  const img = await loadImage(url);
  const bounds = detectContentBounds(img);
  const targetRatio = ASPECT[format];
  const { w: tw, h: th } = targetSize(format);

  const subjectCx = bounds.x + bounds.w / 2;
  const subjectCy = bounds.y + bounds.h / 2;

  const padW = bounds.w * 1.16;
  const padH = bounds.h * 1.16;

  let cropW = padW;
  let cropH = padW / targetRatio;
  if (cropH < padH) {
    cropH = padH;
    cropW = padH * targetRatio;
  }

  cropW = Math.min(cropW, img.width);
  cropH = Math.min(cropH, img.height);

  let cropX = subjectCx - cropW / 2;
  let cropY = subjectCy - cropH / 2;
  cropX = Math.max(0, Math.min(img.width - cropW, cropX));
  cropY = Math.max(0, Math.min(img.height - cropH, cropY));

  const { canvas, ctx } = makeCanvas(tw, th);
  const { r, g, b } = sampleCornerColor(img);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, tw, th);

  ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, tw, th);
  return canvas.toDataURL("image/png");
}

/**
 * Light Image Enhancement: subtle contrast + saturation boost + mild sharpen.
 * Operates at native size — never resizes.
 */
export async function enhanceImage(url: string): Promise<string> {
  const img = await loadImage(url);
  const { canvas, ctx } = makeCanvas(img.width, img.height);

  ctx.filter = "contrast(1.07) saturate(1.08) brightness(1.02)";
  ctx.drawImage(img, 0, 0);
  ctx.filter = "none";

  if (img.width * img.height < 4_000_000) {
    const blur = makeCanvas(img.width, img.height);
    blur.ctx.filter = "blur(1.2px)";
    blur.ctx.drawImage(canvas, 0, 0);
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.18;
    ctx.drawImage(blur.canvas, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  return canvas.toDataURL("image/jpeg", 0.92);
}
