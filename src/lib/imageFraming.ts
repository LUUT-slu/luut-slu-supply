// Product-aware image framing utilities.
// Unlike imagePrep helpers (which target the poster aspect), these target
// an arbitrary CONTAINER aspect — so the resulting image can render with
// `object-fit: contain` and never be cropped or stretched again at display.
//
// Pipeline:
//   1. Decode the source image.
//   2. Detect the product bounding box (background-color rejection).
//   3. Build an output canvas matching the requested containerAspect, sized
//      so the product (with safe margin) fills the long edge.
//   4. Center the product, fill background with the sampled corner color.
//   5. Return a PNG data URL.

const OUTPUT_LONG_EDGE = 1400;
const SUBJECT_MARGIN = 0.12; // 12% breathing room around the product

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

function avg(xs: number[]) {
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

/** Sample 4-corner background color of an image. */
export function sampleCornerColor(img: HTMLImageElement): {
  r: number;
  g: number;
  b: number;
} {
  const { ctx } = makeCanvas(img.width, img.height);
  ctx.drawImage(img, 0, 0);
  const w = img.width, h = img.height;
  const px = [
    ctx.getImageData(0, 0, 1, 1).data,
    ctx.getImageData(w - 1, 0, 1, 1).data,
    ctx.getImageData(0, h - 1, 1, 1).data,
    ctx.getImageData(w - 1, h - 1, 1, 1).data,
  ];
  return {
    r: Math.round(avg(px.map((p) => p[0]))),
    g: Math.round(avg(px.map((p) => p[1]))),
    b: Math.round(avg(px.map((p) => p[2]))),
  };
}

/**
 * Find the bounding box of "non-background" pixels by downsampling and
 * rejecting pixels close to the corner-sampled background color.
 * Returns coordinates in source-image space.
 */
export function detectContentBounds(
  img: HTMLImageElement,
): { x: number; y: number; w: number; h: number } {
  const maxSide = 220;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const sw = Math.max(8, Math.round(img.width * scale));
  const sh = Math.max(8, Math.round(img.height * scale));

  const { ctx } = makeCanvas(sw, sh);
  ctx.drawImage(img, 0, 0, sw, sh);
  const { data } = ctx.getImageData(0, 0, sw, sh);

  const cornerIdx = [0, (sw - 1) * 4, sw * (sh - 1) * 4, (sw * sh - 1) * 4];
  const bgR = avg(cornerIdx.map((i) => data[i]));
  const bgG = avg(cornerIdx.map((i) => data[i + 1]));
  const bgB = avg(cornerIdx.map((i) => data[i + 2]));

  const TOL = 28;
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

  if (!found) return { x: 0, y: 0, w: img.width, h: img.height };

  const inv = 1 / scale;
  const x = Math.max(0, Math.floor(minX * inv));
  const y = Math.max(0, Math.floor(minY * inv));
  const w = Math.min(img.width - x, Math.ceil((maxX - minX + 1) * inv));
  const h = Math.min(img.height - y, Math.ceil((maxY - minY + 1) * inv));
  return { x, y, w, h };
}

/**
 * frameProduct — returns a PNG sized to `containerAspect` with the product
 * centered, scaled proportionally with safe margin, background filled with
 * the sampled corner color. Never stretches. Never crops the product.
 *
 * Use this when the rendered <img> uses object-fit: contain — preview and
 * export will then be pixel-identical (no further crop or stretch).
 */
export async function frameProduct(
  url: string,
  containerAspect: number,
): Promise<string> {
  const img = await loadImage(url);
  const bounds = detectContentBounds(img);

  // Choose output size matching containerAspect.
  let outW: number, outH: number;
  if (containerAspect >= 1) {
    outW = OUTPUT_LONG_EDGE;
    outH = Math.round(OUTPUT_LONG_EDGE / containerAspect);
  } else {
    outH = OUTPUT_LONG_EDGE;
    outW = Math.round(OUTPUT_LONG_EDGE * containerAspect);
  }

  const { canvas, ctx } = makeCanvas(outW, outH);
  const { r, g, b } = sampleCornerColor(img);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, outW, outH);

  // Fit the bounded subject inside (1 - margin) of the canvas.
  const safeW = outW * (1 - SUBJECT_MARGIN * 2);
  const safeH = outH * (1 - SUBJECT_MARGIN * 2);
  const fit = Math.min(safeW / bounds.w, safeH / bounds.h);
  const dw = bounds.w * fit;
  const dh = bounds.h * fit;
  const dx = (outW - dw) / 2;
  const dy = (outH - dh) / 2;

  ctx.drawImage(img, bounds.x, bounds.y, bounds.w, bounds.h, dx, dy, dw, dh);
  return canvas.toDataURL("image/png");
}
