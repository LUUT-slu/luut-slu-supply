import { useSiteSettings } from "@/hooks/useSiteSettings";
import { Copy } from "lucide-react";
import { toast } from "sonner";

export function SaleBanner() {
  const { data: settings } = useSiteSettings();

  // Only show if 1k-sale popup is enabled
  const salePopup = settings?.popups?.find((p) => p.id === "1k-sale");
  if (!salePopup?.enabled) return null;

  // Date range check
  const now = new Date();
  if (salePopup.startAt && new Date(salePopup.startAt) > now) return null;
  if (salePopup.endAt && new Date(salePopup.endAt) < now) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText("1KPROMO");
    toast.success("Code copied!", { position: "top-center" });
  };

  return (
    <div
      onClick={handleCopy}
      className="flex cursor-pointer items-center justify-center gap-2 bg-black px-4 py-2 text-center text-xs font-medium text-yellow-400 transition-colors hover:bg-black/90 sm:text-sm"
    >
      <span>
        🎉 1K SALE: <strong>15% OFF</strong> — Use code{" "}
        <strong className="underline underline-offset-2">1KPROMO</strong>{" "}
        <span className="hidden sm:inline">(7 days)</span>
      </span>
      <Copy className="h-3 w-3 opacity-60" />
    </div>
  );
}
