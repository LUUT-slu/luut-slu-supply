/**
 * Resize an image file to a 1:1 square aspect ratio.
 * Centers the image and crops to fill the square, then returns a new File.
 */
export function resizeImageToSquare(
  file: File,
  size: number = 1024
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }

      // Calculate crop: center-crop to square
      const srcSize = Math.min(img.width, img.height);
      const sx = (img.width - srcSize) / 2;
      const sy = (img.height - srcSize) / 2;

      // Fill with white background (for transparent PNGs)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);

      // Draw the center-cropped square region scaled to target size
      ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, size, size);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Failed to create blob"));
            return;
          }
          // Preserve original filename but force .jpg extension
          const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
          resolve(new File([blob], name, { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.85
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}
