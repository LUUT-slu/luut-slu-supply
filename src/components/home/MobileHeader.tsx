import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/stores/cartStore";
import { MobileMenuDrawer } from "@/components/home/MobileMenuDrawer";
import { LocaleSelector } from "@/components/locale/LocaleSelector";

export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const totalItems = useCartStore((s) => s.getTotalItems());

  return (
    <header className="sticky top-0 z-40 w-full border-b border-primary/20 bg-background/70 backdrop-blur-md supports-[backdrop-filter]:bg-background/50">
      <div className="flex h-14 items-center justify-between px-4">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-foreground/90 active:scale-95 transition-transform touch-manipulation"
        >
          <Menu className="h-6 w-6" />
        </button>

        <MobileMenuDrawer open={open} onOpenChange={setOpen} />

        <Link to="/" aria-label="Luut SLU home" className="absolute left-1/2 -translate-x-1/2">
          <span className="font-display text-xl font-bold tracking-[0.18em] text-primary">LUUT SLU</span>
        </Link>

        <div className="flex items-center gap-1.5">
          <LocaleSelector compact />
          <Link
            to="/cart"
            aria-label="Cart"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-foreground/90 active:scale-95 transition-transform touch-manipulation"
          >
            <ShoppingCart className="h-5 w-5" />
            {totalItems > 0 && (
              <Badge className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary p-0 px-1.5 text-[10px] font-bold text-primary-foreground">
                {totalItems > 9 ? "9+" : totalItems}
              </Badge>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
