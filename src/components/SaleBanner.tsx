import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useCountdown } from "@/hooks/useCountdown";
import { Copy } from "lucide-react";
import { toast } from "sonner";

export function SaleBanner() {
  const { data: settings } = useSiteSettings();

  const salePopup = settings?.popups?.find((p) => p.id === "1k-sale");

  const { formatted, isExpired } = useCountdown(salePopup?.endAt);

  if (!salePopup?.enabled) return null;

  // Date range check
  const now = new Date();
  if (salePopup.startAt && new Date(salePopup.startAt) > now) return null;
  if (isExpired && salePopup.endAt) return null;

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
        🎉 1K SALE: <strong>15% OFF</strong> — CODE:{" "}
        <strong className="underline underline-offset-2">1KPROMO</strong>
        {formatted && (
          <span className="ml-2">
            — ENDS IN: <strong>{formatted}</strong>
          </span>
        )}
      </span>
      <Copy className="h-3 w-3 opacity-60" />
    </div>
  );
}
