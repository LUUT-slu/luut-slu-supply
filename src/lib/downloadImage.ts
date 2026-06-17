/**
 * Cross-browser image download that works on mobile (iOS Safari, Android Chrome).
 *
 * Strategy:
 *  1. Fetch the image as a blob (handles cross-origin downloads).
 *  2. If the device supports Web Share API with files, share the file —
 *     this lets users save to Photos on iOS or share to any app.
 *  3. Otherwise create an object URL and trigger a download via anchor click.
 *  4. On iOS Safari (where `download` attribute is ignored), open the blob
 *     in a new tab so the user can long-press to save.
 */
export async function downloadImage(url: string, filename = "luut-image.png"): Promise<void> {
  const ensureExt = (name: string, mime: string) => {
    if (/\.[a-z0-9]{2,5}$/i.test(name)) return name;
    const ext = mime.includes("jpeg") ? "jpg"
      : mime.includes("png") ? "png"
      : mime.includes("webp") ? "webp"
      : "png";
    return `${name}.${ext}`;
  };

  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const finalName = ensureExt(filename, blob.type);

    // 1) Web Share API with files (best UX on mobile — saves to Photos on iOS)
    const navAny: any = navigator;
    try {
      const file = new File([blob], finalName, { type: blob.type || "image/png" });
      if (navAny.canShare && navAny.canShare({ files: [file] })) {
        await navAny.share({ files: [file], title: finalName });
        return;
      }
    } catch {
      // user cancelled share OR share failed — fall through to download
    }

    // 2) Standard anchor download (desktop & Android Chrome)
    const objUrl = URL.createObjectURL(blob);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    if (isIOS) {
      // iOS Safari ignores the `download` attribute; opening the blob lets the
      // user long-press the image and choose "Save to Photos".
      window.open(objUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(objUrl), 60_000);
      return;
    }

    const a = document.createElement("a");
    a.href = objUrl;
    a.download = finalName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
  } catch {
    // Last-resort fallback
    window.open(url, "_blank", "noopener");
  }
}
