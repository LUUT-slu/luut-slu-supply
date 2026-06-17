import { useEffect } from "react";
import { X, Download } from "lucide-react";
import { downloadImage } from "@/lib/downloadImage";

interface Props {
  open: boolean;
  src: string | null;
  onClose: () => void;
  showDownload?: boolean;
  filename?: string;
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
            downloadImage(src, filename || "luut-poster.png");
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
