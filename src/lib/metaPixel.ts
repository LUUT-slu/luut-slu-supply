// Meta Pixel helper. The base pixel is loaded in index.html.
declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

export function fbqTrack(event: string, params?: Record<string, any>) {
  if (typeof window === "undefined") return;
  try {
    window.fbq?.("track", event, params);
  } catch {
    // no-op
  }
}
