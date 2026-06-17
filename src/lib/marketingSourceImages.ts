const MAX_SOURCE_IMAGE_EDGE = 1400;
const JPEG_QUALITY = 0.82;

const readAsDataUrl = (file: File) =>
  new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

export async function prepareMarketingSourceImage(file: File): Promise<string | null> {
  const dataUrl = await readAsDataUrl(file);
  if (!dataUrl) return null;

  try {
    const img = await loadImage(dataUrl);
    const scale = Math.min(1, MAX_SOURCE_IMAGE_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } catch {
    return dataUrl;
  }
}

export async function prepareMarketingSourceImages(files: File[], limit: number): Promise<string[]> {
  const prepared: string[] = [];
  for (const file of files.slice(0, limit)) {
    const image = await prepareMarketingSourceImage(file);
    if (image) prepared.push(image);
  }
  return prepared;
}