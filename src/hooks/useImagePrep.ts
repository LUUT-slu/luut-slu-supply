// Manages the image-prep mode + cache for Marketing Studio.
// Cache key is `(sourceUrl + mode + format + containerAspect)` so re-selecting
// a mode is instant and the preview/export always see the same prepared URL.
//
// When `containerAspect` is provided, "auto-fit" routes through frameProduct
// to produce an image matching the live container — so the rendered <img>
// can use object-fit: contain and preview = export pixel-for-pixel.

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { autoFitProduct, smartReframe, enhanceImage } from "@/lib/imagePrep";
import { frameProduct } from "@/lib/imageFraming";
import type { TemplateFormat } from "@/components/marketing/templates";

export type PrepMode =
  | "original"
  | "auto-fit"
  | "reframe"
  | "remove-bg"
  | "expand"
  | "enhance";

export const PREP_MODES: { key: PrepMode; label: string; ai: boolean; hint: string }[] = [
  { key: "original", label: "Original", ai: false, hint: "Use the photo as-is" },
  { key: "auto-fit", label: "Auto Fit", ai: false, hint: "Center & frame the product" },
  { key: "reframe", label: "Smart Reframe", ai: false, hint: "Crop intelligently around product" },
  { key: "remove-bg", label: "Remove BG", ai: true, hint: "AI cleans the background" },
  { key: "expand", label: "Expand to Fit", ai: true, hint: "AI extends background, never crops product" },
  { key: "enhance", label: "Enhance", ai: false, hint: "Sharpen & boost clarity" },
];

interface CacheEntry {
  url: string;
  ts: number;
}

const cache = new Map<string, CacheEntry>();
const cacheKey = (
  src: string,
  mode: PrepMode,
  format: TemplateFormat,
  containerAspect?: number,
) => {
  const a = containerAspect ? containerAspect.toFixed(3) : "poster";
  return `${mode}::${format}::${a}::${src}`;
};

export function useImagePrep(
  sourceUrl: string | undefined,
  format: TemplateFormat,
  containerAspect?: number,
) {
  const [mode, setMode] = useState<PrepMode>("original");
  const [preparedUrl, setPreparedUrl] = useState<string | undefined>(sourceUrl);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    setError(null);
    if (!sourceUrl) {
      setPreparedUrl(undefined);
      return;
    }
    if (mode === "original") {
      setPreparedUrl(sourceUrl);
      return;
    }

    const key = cacheKey(sourceUrl, mode, format, containerAspect);
    const cached = cache.get(key);
    if (cached) {
      setPreparedUrl(cached.url);
      return;
    }

    const myReq = ++reqIdRef.current;
    setIsProcessing(true);

    (async () => {
      try {
        let result: string;
        if (mode === "auto-fit") {
          // Container-aspect framing when we know the live container size,
          // otherwise fall back to poster-aspect framing.
          result = containerAspect
            ? await frameProduct(sourceUrl, containerAspect)
            : await autoFitProduct(sourceUrl, format);
        } else if (mode === "reframe") {
          result = containerAspect
            ? await frameProduct(sourceUrl, containerAspect)
            : await smartReframe(sourceUrl, format);
        } else if (mode === "enhance") {
          result = await enhanceImage(sourceUrl);
        } else {
          // AI modes
          const { data, error: fnError } = await supabase.functions.invoke(
            "ai-image-prep",
            { body: { imageUrl: sourceUrl, mode, format } },
          );
          if (fnError) throw new Error(fnError.message || "AI request failed");
          if (!data?.url) throw new Error(data?.error || "AI returned no image");
          result = data.url as string;
        }

        if (myReq !== reqIdRef.current) return;
        cache.set(key, { url: result, ts: Date.now() });
        setPreparedUrl(result);
      } catch (e: any) {
        if (myReq !== reqIdRef.current) return;
        const msg = e?.message || "Image preparation failed";
        console.error("useImagePrep error:", e);
        setError(msg);
        toast.error(msg);
        setMode("original");
        setPreparedUrl(sourceUrl);
      } finally {
        if (myReq === reqIdRef.current) setIsProcessing(false);
      }
    })();
  }, [sourceUrl, mode, format, containerAspect]);

  const reset = useCallback(() => setMode("original"), []);

  return { mode, setMode, preparedUrl, isProcessing, error, reset };
}
