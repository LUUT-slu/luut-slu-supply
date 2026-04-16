import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSiteSettings, PopupSetting } from "@/hooks/useSiteSettings";
import { useCountdown } from "@/hooks/useCountdown";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

function shouldShowPopup(popup: PopupSetting, pathname: string): boolean {
  if (!popup.enabled) return false;

  const now = new Date();
  if (popup.startAt && new Date(popup.startAt) > now) return false;
  if (popup.endAt && new Date(popup.endAt) < now) return false;

  const pageMap: Record<string, string[]> = {
    home: ["/"],
    product: ["/product/", "/product"],
    shop: ["/shop"],
    all: [],
  };

  if (!popup.pages.includes("all")) {
    const matched = popup.pages.some((page) => {
      const paths = pageMap[page] || [];
      return paths.some((p) => pathname === p || pathname.startsWith(p + "/"));
    });
    if (!matched) return false;
  }

  const storageKey = `popup-seen-${popup.id}`;
  if (popup.frequency === "once_per_session") {
    if (sessionStorage.getItem(storageKey)) return false;
  } else if (popup.frequency === "once_per_24h") {
    const lastSeen = localStorage.getItem(storageKey);
    if (lastSeen && Date.now() - parseInt(lastSeen) < 86400000) return false;
  }

  return true;
}

function markPopupSeen(popup: PopupSetting) {
  const storageKey = `popup-seen-${popup.id}`;
  if (popup.frequency === "once_per_session") {
    sessionStorage.setItem(storageKey, "1");
  } else {
    localStorage.setItem(storageKey, String(Date.now()));
  }
}

export function SalePopup() {
  const { data: settings } = useSiteSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [activePopup, setActivePopup] = useState<PopupSetting | null>(null);
  const [open, setOpen] = useState(false);

  const { formatted: countdown, isExpired } = useCountdown(activePopup?.endAt);

  useEffect(() => {
    if (!settings?.popups) return;

    const timer = setTimeout(() => {
      const popup = settings.popups.find((p) => shouldShowPopup(p, location.pathname));
      if (popup) {
        setActivePopup(popup);
        setOpen(true);
        markPopupSeen(popup);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [settings?.popups, location.pathname]);

  if (!activePopup || !open) return null;
  if (isExpired && activePopup.endAt) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText("1KPROMO");
    toast.success("Code copied!", { position: "top-center" });
  };

  const handleShopSale = () => {
    setOpen(false);
    navigate(activePopup.buttonUrl || "/shop");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm border-yellow-500/30 bg-[hsl(0,0%,7%)] p-0 text-white sm:max-w-md [&>button]:text-white/60 [&>button]:hover:text-white">
        <div className="flex flex-col items-center px-6 pb-8 pt-10 text-center">
          <p className="mb-1 text-sm font-medium uppercase tracking-[0.3em] text-yellow-400/80">
            Celebrating
          </p>
          <h2 className="mb-2 text-4xl font-black tracking-tight sm:text-5xl">
            WE HIT 1K{" "}
            <span className="inline-block animate-bounce">🎉</span>
          </h2>
          <p className="mb-1 text-sm text-white/60">
            15% OFF STOREWIDE
          </p>
          {countdown && (
            <p className="mb-5 text-xs font-semibold tracking-widest text-yellow-400/70">
              ENDS IN: {countdown}
            </p>
          )}

          <div className="mb-2 w-full rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-6 py-4">
            <p className="mb-1 text-xs uppercase tracking-widest text-yellow-400/70">
              Use code
            </p>
            <p className="text-3xl font-black tracking-[0.15em] text-yellow-400 sm:text-4xl">
              1KPROMO
            </p>
          </div>
          <p className="mb-8 text-xs text-white/40">
            One-time use per customer.
          </p>

          <div className="flex w-full flex-col gap-3">
            <Button
              onClick={handleShopSale}
              className="w-full bg-yellow-400 text-black hover:bg-yellow-300 font-bold text-base py-6"
              size="lg"
            >
              <ShoppingBag className="mr-2 h-5 w-5" />
              SHOP THE SALE
            </Button>
            <Button
              onClick={handleCopyCode}
              variant="outline"
              className="w-full border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
              size="lg"
            >
              <Copy className="mr-2 h-4 w-4" />
              COPY CODE
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
