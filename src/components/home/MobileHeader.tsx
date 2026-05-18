import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, ShoppingCart } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/stores/cartStore";
import { MobileCategoryDrawer } from "@/components/MobileCategoryDrawer";

export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const totalItems = useCartStore((s) => s.getTotalItems());

  return (
    <header className="sticky top-0 z-40 w-full border-b border-primary/20 bg-background/70 backdrop-blur-md supports-[backdrop-filter]:bg-background/50">
      <div className="flex h-14 items-center justify-between px-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              aria-label="Open menu"
              className="flex h-10 w-10 items-center justify-center rounded-full text-foreground/90 active:scale-95 transition-transform touch-manipulation"
            >
              <Menu className="h-6 w-6" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 bg-background p-0 overflow-y-auto">
            <div className="flex flex-col min-h-full">
              <div className="border-b border-border p-6 sticky top-0 bg-background z-10">
                <span className="font-display text-2xl text-primary tracking-wider">LUUT SLU</span>
              </div>
              <nav className="flex flex-col p-4">
                <Link to="/shop" onClick={() => setOpen(false)} className="py-3 font-body text-lg font-medium">Shop All</Link>
                <Link to="/shop?filter=new" onClick={() => setOpen(false)} className="py-3 font-body text-lg font-medium">New Arrivals</Link>
                <Link to="/shop?filter=best" onClick={() => setOpen(false)} className="py-3 font-body text-lg font-medium">Best Sellers</Link>
                <Link to="/sellers" onClick={() => setOpen(false)} className="py-3 font-body text-lg font-medium">Sellers</Link>
                <div className="my-4 border-t border-border" />
                <span className="py-2 font-display text-sm text-muted-foreground tracking-wider">SHOP BY CATEGORY</span>
                <MobileCategoryDrawer onNavigate={() => setOpen(false)} />
                <div className="my-4 border-t border-border" />
                <Link to="/sell" onClick={() => setOpen(false)} className="py-3 font-body text-lg font-medium text-primary">Sell on Luut</Link>
                <Link to="/account" onClick={() => setOpen(false)} className="py-3 font-body text-lg font-medium">My Account</Link>
              </nav>
            </div>
          </SheetContent>
        </Sheet>

        <Link to="/" aria-label="Luut SLU home" className="absolute left-1/2 -translate-x-1/2">
          <span className="font-display text-xl font-bold tracking-[0.18em] text-primary">LUUT SLU</span>
        </Link>

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
    </header>
  );
}
