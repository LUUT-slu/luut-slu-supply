import { useEffect } from "react";
import { X, Download } from "lucide-react";

interface Props {
  open: boolean;
  src: string | null;
  onClose: () => void;
  showDownload?: boolean;
  filename?: string;
}

async function downloadOrShare(url: string, filename = "luut-poster.png") {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const file = new File([blob], filename, { type: blob.type || "image/png" });
    const navAny: any = navigator;
    if (navAny.canShare && navAny.canShare({ files: [file] })) {
      await navAny.share({ files: [file], title: "LUUT Poster" });
      return;
    }
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
  } catch {
    window.open(url, "_blank");
  }
}

export default function PosterLightbox({ open, src, onClose, showDownload, filename }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !src) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.92)", zIndex: 100 }}
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close"
        className="fixed flex items-center justify-center"
        style={{
          top: 16,
          right: 16,
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          border: "none",
          zIndex: 102,
        }}
      >
        <X size={22} />
      </button>

      <img
        src={src}
        alt="Poster preview"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxHeight: "90vh",
          maxWidth: "90vw",
          objectFit: "contain",
        }}
      />

      {showDownload && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            downloadOrShare(src, filename);
          }}
          className="fixed left-1/2 -translate-x-1/2"
          style={{
            bottom: 24,
            width: "calc(100% - 32px)",
            maxWidth: 280,
            padding: "14px 16px",
            background: "#e8e8e8",
            color: "#080808",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            zIndex: 102,
          }}
        >
          <Download size={16} />
          Download
        </button>
      )}
    </div>
  );
}
