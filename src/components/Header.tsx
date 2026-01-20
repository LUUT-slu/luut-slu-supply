import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Menu, X, ShoppingBag, DollarSign, User } from "lucide-react";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { useCartStore } from "@/stores/cartStore";
import { CartDrawer } from "./CartDrawer";
import { Badge } from "./ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

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
  const [orderCount, setOrderCount] = useState(0);
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const totalItems = useCartStore((state) => state.getTotalItems());

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchActiveOrderCount = async () => {
      const savedOrderIds = JSON.parse(localStorage.getItem("luut-my-orders") || "[]");
      
      if (savedOrderIds.length === 0) {
        setOrderCount(0);
        return;
      }

      // Fetch actual order statuses from database
      const { data, error } = await supabase
        .from("orders")
        .select("id, status")
        .in("id", savedOrderIds);

      if (error) {
        console.error("Failed to fetch order statuses:", error);
        return;
      }

      // Count non-completed orders
      const activeOrders = (data || []).filter(
        (order) => order.status !== "completed" && order.status !== "cancelled"
      );
      
      setOrderCount(Math.min(activeOrders.length, 10));
    };
    
    fetchActiveOrderCount();
  }, []);

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
            className="relative font-display text-lg tracking-wide text-primary transition-colors hover:text-primary/80"
          >
            My Orders
            {orderCount > 0 && (
              <Badge className="absolute -right-5 -top-2 h-5 min-w-5 justify-center rounded-full px-1.5 text-xs">
                {orderCount === 10 ? "10+" : orderCount}
              </Badge>
            )}
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
            to="/sellers"
            className="font-body text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
          >
            Sellers
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
          <Link to={currentUser ? "/account" : "/login"}>
            <Button variant="ghost" size="icon" className="text-foreground hover:text-primary">
              <User className="h-5 w-5" />
            </Button>
          </Link>
          <Link to="/admin">
            <Button variant="ghost" size="icon" className="text-foreground hover:text-primary">
              <DollarSign className="h-5 w-5" />
            </Button>
          </Link>
          <CartDrawer />

          {/* Mobile menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 bg-background p-0 overflow-y-auto">
              <div className="flex flex-col min-h-full">
                <div className="border-b border-border p-6 sticky top-0 bg-background z-10">
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
                  <Link
                    to="/sellers"
                    onClick={() => setIsOpen(false)}
                    className="py-3 font-body text-lg font-medium text-foreground"
                  >
                    Sellers
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
                  
                  <Link
                    to={currentUser ? "/account" : "/login"}
                    onClick={() => setIsOpen(false)}
                    className="py-3 font-body text-lg font-medium text-foreground flex items-center gap-2"
                  >
                    <User className="h-5 w-5" />
                    {currentUser ? "My Account" : "Sign In"}
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
