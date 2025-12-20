import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X, ShoppingBag } from "lucide-react";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { useCartStore } from "@/stores/cartStore";
import { CartDrawer } from "./CartDrawer";

const outfitCategories = [
  { name: "Beanies", path: "/shop/beanies" },
  { name: "Hats", path: "/shop/hats" },
  { name: "Ski Masks / Facewear", path: "/shop/facewear" },
  { name: "Shirts", path: "/shop/shirts" },
  { name: "Jackets", path: "/shop/jackets" },
  { name: "Hoodies", path: "/shop/hoodies" },
  { name: "Pants", path: "/shop/pants" },
  { name: "Shorts", path: "/shop/shorts" },
  { name: "Boxers", path: "/shop/boxers" },
  { name: "Bags", path: "/shop/bags" },
  { name: "Shoes", path: "/shop/shoes" },
  { name: "Slippers", path: "/shop/slippers" },
  { name: "Sandals", path: "/shop/sandals" },
  { name: "Socks", path: "/shop/socks" },
];

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const totalItems = useCartStore((state) => state.getTotalItems());

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between md:h-20">
        {/* Logo and My Orders */}
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="font-display text-2xl tracking-wide md:text-3xl">
              <span className="text-primary">Home</span>
            </span>
          </Link>
          <Link
            to="/my-orders"
            className="font-body text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
          >
            My Orders
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-6 lg:flex">
          <Link
            to="/shop"
            className="font-body text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
          >
            Shop Outfits
          </Link>
          <Link
            to="/shop?filter=new"
            className="font-body text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
          >
            New Arrivals
          </Link>
          <Link
            to="/shop?filter=best"
            className="font-body text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
          >
            Best Sellers
          </Link>
          <Link
            to="/sell"
            className="font-body text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
          >
            Sell on Luut
          </Link>
        </nav>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          <CartDrawer />

          {/* Mobile menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 bg-background p-0">
              <div className="flex flex-col">
                <div className="border-b border-border p-6">
                  <span className="font-display text-2xl text-primary">Home</span>
                </div>
                
                <nav className="flex flex-col p-4">
                  <Link
                    to="/shop"
                    onClick={() => setIsOpen(false)}
                    className="py-3 font-body text-lg font-medium text-foreground"
                  >
                    Shop All Outfits
                  </Link>
                  <Link
                    to="/shop?filter=new"
                    onClick={() => setIsOpen(false)}
                    className="py-3 font-body text-lg font-medium text-foreground"
                  >
                    New Arrivals
                  </Link>
                  <Link
                    to="/shop?filter=best"
                    onClick={() => setIsOpen(false)}
                    className="py-3 font-body text-lg font-medium text-foreground"
                  >
                    Best Sellers
                  </Link>
                  
                  <div className="my-4 border-t border-border" />
                  
                  <span className="py-2 font-display text-sm text-muted-foreground">
                    SHOP BY CATEGORY
                  </span>
                  {outfitCategories.map((cat) => (
                    <Link
                      key={cat.path}
                      to={cat.path}
                      onClick={() => setIsOpen(false)}
                      className="py-2 font-body text-sm text-foreground/80 transition-colors hover:text-primary"
                    >
                      {cat.name}
                    </Link>
                  ))}
                  
                  <div className="my-4 border-t border-border" />
                  
                  <Link
                    to="/sell"
                    onClick={() => setIsOpen(false)}
                    className="py-3 font-body text-lg font-medium text-primary"
                  >
                    Sell on Luut
                  </Link>
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
