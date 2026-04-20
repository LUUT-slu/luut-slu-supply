/**
 * Per-image crop / reframe state for the Marketing Studio image editor.
 *
 *  - scale:    1.0 = fits the frame (object-fit: cover baseline). Up to 4x zoom.
 *  - offsetX:  -1..1 normalized horizontal offset relative to the frame width.
 *              0 = centered, -1 = pushed all the way to the left, 1 = right.
 *  - offsetY:  -1..1 normalized vertical offset relative to frame height.
 *
 * Offsets are normalized so the same crop survives different preview frame
 * sizes (e.g. mobile vs desktop preview vs full-resolution export).
 */
export interface CropState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export const DEFAULT_CROP: CropState = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

export const MIN_SCALE = 1; // can't zoom out past "fit"
export const MAX_SCALE = 4;

export function isDefaultCrop(c: CropState | undefined | null): boolean {
  if (!c) return true;
  return c.scale === 1 && c.offsetX === 0 && c.offsetY === 0;
}

export function clampCrop(c: CropState): CropState {
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, c.scale));
  // Bound offsets so the image can never reveal an empty edge.
  // At scale s, the image overflows the frame by (s-1) on each axis (50% each side).
  // Normalized offset range is therefore [-(s-1), s-1].
  const limit = scale - 1;
  return {
    scale,
    offsetX: Math.max(-limit, Math.min(limit, c.offsetX)),
    offsetY: Math.max(-limit, Math.min(limit, c.offsetY)),
  };
}

/**
 * Build the CSS `transform` value to apply to an `<img>` rendered with
 * `object-fit: cover` inside its frame so the visible window matches the
 * supplied crop state.
 */
export function cropToTransform(c: CropState): string {
  const { scale, offsetX, offsetY } = c;
  // Translate by 50% of (offset / scale) so normalized offset maps to
  // proportion of the FRAME (not the scaled image).
  const tx = (offsetX / scale) * 50;
  const ty = (offsetY / scale) * 50;
  return `scale(${scale}) translate(${tx}%, ${ty}%)`;
}

/**
 * Compute the source rectangle (`sx, sy, sw, sh`) on the original full-
 * resolution image that should be drawn into a destination rect of size
 * (dw, dh) to reproduce the supplied crop, assuming `object-fit: cover`.
 */
export function cropToSourceRect(
  natW: number,
  natH: number,
  dw: number,
  dh: number,
  c: CropState,
): { sx: number; sy: number; sw: number; sh: number } {
  const dstRatio = dw / dh;
  const srcRatio = natW / natH;
  // Base "cover" rect on the natural image
  let baseW: number;
  let baseH: number;
  if (srcRatio > dstRatio) {
    baseH = natH;
    baseW = natH * dstRatio;
  } else {
    baseW = natW;
    baseH = natW / dstRatio;
  }
  // Apply zoom (smaller source rect = zoomed in)
  const sw = baseW / c.scale;
  const sh = baseH / c.scale;
  // Center, then shift by normalized offset relative to the visible window.
  // offsetX = -1 means pan the image to the right edge of the source band.
  const cxBase = (natW - sw) / 2;
  const cyBase = (natH - sh) / 2;
  const maxShiftX = (natW - sw) / 2;
  const maxShiftY = (natH - sh) / 2;
  const sx = cxBase - c.offsetX * maxShiftX;
  const sy = cyBase - c.offsetY * maxShiftY;
  return {
    sx: Math.max(0, Math.min(natW - sw, sx)),
    sy: Math.max(0, Math.min(natH - sh, sy)),
    sw,
    sh,
  };
}
