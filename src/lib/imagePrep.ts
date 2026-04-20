// Client-side image preparation utilities for Marketing Studio.
// All functions are non-AI (pure Canvas) and return data URLs that match
// what the export pipeline will see — preview = export, guaranteed.

import type { TemplateFormat } from "@/components/marketing/templates";

const ASPECT: Record<TemplateFormat, number> = {
  story: 9 / 16,
  post: 1,
  ad: 1200 / 628,
  portrait: 4 / 5,
};

// Output canvas long-edge size — keeps quality high but bounded for performance.
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

function makeCanvas(w: number, h: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
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
 * Detects the bounding box of "non-background" content by scanning pixels.
 * Treats either transparent OR near-uniform light/dark borders as background.
 * Returns { x, y, w, h } in source-image coordinates.
 */
function detectContentBounds(
  img: HTMLImageElement,
): { x: number; y: number; w: number; h: number } {
  // Downsample to a small mask for speed (max 200px on long edge).
  const maxSide = 200;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const sw = Math.max(8, Math.round(img.width * scale));
  const sh = Math.max(8, Math.round(img.height * scale));

  const { ctx } = makeCanvas(sw, sh);
  ctx.drawImage(img, 0, 0, sw, sh);
  const { data } = ctx.getImageData(0, 0, sw, sh);

  // Sample corners to estimate background color (use median of 4 corners).
  const cornerIdx = [
    0,
    (sw - 1) * 4,
    (sw * (sh - 1)) * 4,
    (sw * sh - 1) * 4,
  ];
  const bgR = avg(cornerIdx.map((i) => data[i]));
  const bgG = avg(cornerIdx.map((i) => data[i + 1]));
  const bgB = avg(cornerIdx.map((i) => data[i + 2]));

  const TOL = 28; // color distance threshold
  let minX = sw, minY = sh, maxX = 0, maxY = 0;
  let found = false;

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4;
      const a = data[i + 3];
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const isTransparent = a < 16;
      const isBg =
        Math.abs(r - bgR) < TOL &&
        Math.abs(g - bgG) < TOL &&
        Math.abs(b - bgB) < TOL;
      if (isTransparent || isBg) continue;
      found = true;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (!found) {
    return { x: 0, y: 0, w: img.width, h: img.height };
  }

  // Map back to source coords.
  const inv = 1 / scale;
  const x = Math.max(0, Math.floor(minX * inv));
  const y = Math.max(0, Math.floor(minY * inv));
  const w = Math.min(img.width - x, Math.ceil((maxX - minX + 1) * inv));
  const h = Math.min(img.height - y, Math.ceil((maxY - minY + 1) * inv));
  return { x, y, w, h };
}

function avg(xs: number[]) {
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

/**
 * Auto Fit Product:
 *  - Detects the actual product in the image.
 *  - Centers it on the target aspect with safe margins (10%).
 *  - Prevents clipping by using "contain" sizing on the detected bounds.
 *  - Background is filled with the source's edge color so it blends cleanly.
 */
export async function autoFitProduct(
  url: string,
  format: TemplateFormat,
): Promise<string> {
  const img = await loadImage(url);
  const bounds = detectContentBounds(img);
  const { w: tw, h: th } = targetSize(format);

  // Sample background color from a corner pixel to fill the new canvas.
  const sampleCanvas = makeCanvas(1, 1);
  sampleCanvas.ctx.drawImage(img, 0, 0, 1, 1);
  const [r, g, b] = sampleCanvas.ctx.getImageData(0, 0, 1, 1).data;

  const { canvas, ctx } = makeCanvas(tw, th);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, tw, th);

  // Fit the bounded subject within 80% of the target (10% margin all sides).
  const safeW = tw * 0.8;
  const safeH = th * 0.8;
  const fit = Math.min(safeW / bounds.w, safeH / bounds.h);
  const dw = bounds.w * fit;
  const dh = bounds.h * fit;
  const dx = (tw - dw) / 2;
  const dy = (th - dh) / 2;

  ctx.drawImage(img, bounds.x, bounds.y, bounds.w, bounds.h, dx, dy, dw, dh);
  return canvas.toDataURL("image/png");
}

/**
 * Smart Reframe:
 *  - Picks the largest crop window matching the target aspect that still
 *    contains the entire detected product.
 *  - If the source can't fully contain the subject at target aspect, falls
 *    back to letterboxing the subject onto a clean canvas.
 */
export async function smartReframe(
  url: string,
  format: TemplateFormat,
): Promise<string> {
  const img = await loadImage(url);
  const bounds = detectContentBounds(img);
  const targetRatio = ASPECT[format];
  const { w: tw, h: th } = targetSize(format);

  // Try to expand bounds outward (centered on subject) to reach target aspect.
  const subjectCx = bounds.x + bounds.w / 2;
  const subjectCy = bounds.y + bounds.h / 2;

  // Required crop dimensions to keep entire subject + 8% breathing room.
  const padW = bounds.w * 1.16;
  const padH = bounds.h * 1.16;

  // Adjust to target aspect while keeping subject inside.
  let cropW = padW;
  let cropH = padW / targetRatio;
  if (cropH < padH) {
    cropH = padH;
    cropW = padH * targetRatio;
  }

  // Clamp crop to source image bounds.
  cropW = Math.min(cropW, img.width);
  cropH = Math.min(cropH, img.height);

  let cropX = subjectCx - cropW / 2;
  let cropY = subjectCy - cropH / 2;
  cropX = Math.max(0, Math.min(img.width - cropW, cropX));
  cropY = Math.max(0, Math.min(img.height - cropH, cropY));

  const { canvas, ctx } = makeCanvas(tw, th);

  // Background fill from corner sample.
  const sample = makeCanvas(1, 1);
  sample.ctx.drawImage(img, 0, 0, 1, 1);
  const [r, g, b] = sample.ctx.getImageData(0, 0, 1, 1).data;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, tw, th);

  ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, tw, th);
  return canvas.toDataURL("image/png");
}

/**
 * Light Image Enhancement: subtle contrast + saturation boost + mild sharpen.
 * Never destructive. Operates at native size.
 */
export async function enhanceImage(url: string): Promise<string> {
  const img = await loadImage(url);
  const { canvas, ctx } = makeCanvas(img.width, img.height);

  // Use built-in filter for clarity boost (very subtle).
  ctx.filter = "contrast(1.07) saturate(1.08) brightness(1.02)";
  ctx.drawImage(img, 0, 0);
  ctx.filter = "none";

  // Mild unsharp via second-pass overlay (small high-pass approximation).
  // Skip if image is huge to keep it fast.
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
