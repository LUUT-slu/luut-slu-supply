// Pre-resolves external image URLs into base64 data URLs so html-to-image
// never has to re-fetch them during capture. This eliminates CORS-related
// drops on mobile (especially iOS Safari + Shopify CDN).

import { useEffect, useState } from "react";

const memCache = new Map<string, string>();

async function fetchAsDataUrl(url: string): Promise<string> {
  if (!url) throw new Error("Empty URL");
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;

  const cached = memCache.get(url);
  if (cached) return cached;

  const res = await fetch(url, { mode: "cors", credentials: "omit" });
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status}): ${url}`);
  const blob = await res.blob();
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
  memCache.set(url, dataUrl);
  return dataUrl;
}

/**
 * Resolves a list of URLs to data: URLs. Returns a Map keyed by ORIGINAL URL,
 * suitable for passing as `imagePlaceholders` to html-to-image's toPng.
 * Skips empty / data: / blob: entries. Throws if any required image fails.
 */
export async function prefetchImagesAsDataUrls(
  urls: (string | undefined | null)[],
): Promise<Record<string, string>> {
  const unique = Array.from(
    new Set(
      urls
        .filter((u): u is string => Boolean(u))
        .filter((u) => !u.startsWith("data:") && !u.startsWith("blob:")),
    ),
  );
  const out: Record<string, string> = {};
  await Promise.all(
    unique.map(async (u) => {
      try {
        out[u] = await fetchAsDataUrl(u);
      } catch (e) {
        // Re-throw with clearer context
        console.error("prefetchImagesAsDataUrls failed:", u, e);
        throw e;
      }
    }),
  );
  return out;
}

/**
 * Waits for every <img> inside `root` to be loaded and decoded.
 * Resolves once all images report `complete` and `decode()` succeeds.
 */
export async function waitForDomImages(root: HTMLElement | null): Promise<void> {
  if (!root) return;
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      if (img.complete && img.naturalWidth > 0) {
        try {
          await img.decode();
        } catch {
          /* decode is best-effort */
        }
        return;
      }
      await new Promise<void>((resolve) => {
        const done = () => {
          img.removeEventListener("load", done);
          img.removeEventListener("error", done);
          resolve();
        };
        img.addEventListener("load", done);
        img.addEventListener("error", done);
      });
      try {
        await img.decode();
      } catch {
        /* ignore */
      }
    }),
  );
}

/**
 * Tracks whether all provided URLs are loadable (HEAD-equivalent via fetch).
 * Used to gate the export button so users can't trigger a broken capture.
 */
export function useImagesReady(urls: (string | undefined | null)[]): boolean {
  const key = urls.filter(Boolean).join("|");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    const list = urls.filter((u): u is string => Boolean(u));
    if (list.length === 0) {
      setReady(true);
      return;
    }
    Promise.all(
      list.map(
        (u) =>
          new Promise<boolean>((resolve) => {
            if (u.startsWith("data:") || u.startsWith("blob:")) return resolve(true);
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = u;
          }),
      ),
    ).then((results) => {
      if (cancelled) return;
      setReady(results.every(Boolean));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return ready;
}
