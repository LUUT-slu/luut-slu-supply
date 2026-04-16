import { useState, useEffect } from "react";
import { SaleBanner } from "@/components/SaleBanner";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, ShoppingBag, User, ChevronRight, Search } from "lucide-react";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { useCartStore } from "@/stores/cartStore";
import { Badge } from "./ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { useShopifyCollections, getCollectionPath } from "@/hooks/useShopifyCollections";

// Fallback categories if Shopify collections aren't loaded
const fallbackCategories = [
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
{ name: "Socks", path: "/shop/socks" }];

const mainNav = [
  { label: "Shop All", path: "/shop" },
  { label: "New Arrivals", path: "/shop?filter=new" },
  { label: "Best Sellers", path: "/shop?filter=best" },
  { label: "Sellers", path: "/sellers" },
  { label: "Sell on Luut", path: "/sell" },
];

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [orderCount, setOrderCount] = useState(0);
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [portalLink, setPortalLink] = useState<string | null>(null);
  const totalItems = useCartStore((state) => state.getTotalItems());
  const { collections } = useShopifyCollections();
  const location = useLocation();

  // Use Shopify collections if available, otherwise fallback
  const outfitCategories = collections.length > 0 ?
  collections.map((c) => ({ name: c.title, path: getCollectionPath(c.handle) })) :
  fallbackCategories;

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Determine which portal the user can access
  useEffect(() => {
    if (!currentUser) {
      setPortalLink(null);
      return;
    }

    const checkPortal = async () => {
      const { data: roles } = await supabase.
      from("user_roles").
      select("role").
      eq("user_id", currentUser.id);

      const roleNames = roles?.map((r) => r.role as string) || [];
      if (roleNames.includes("admin")) {
        setPortalLink("/admin");
        return;
      }

      const { data: sellerProfile } = await supabase.
      from("seller_profiles").
      select("is_approved").
      eq("user_id", currentUser.id).
      eq("is_approved", true).
      maybeSingle();

      if (sellerProfile) {
        setPortalLink("/seller");
        return;
      }

      setPortalLink(null);
    };

    checkPortal();
  }, [currentUser]);

  useEffect(() => {
    const fetchActiveOrderCount = async () => {
      const savedOrderIds = JSON.parse(localStorage.getItem("luut-my-orders") || "[]");

      if (savedOrderIds.length === 0) {
        setOrderCount(0);
        return;
      }

      const { data, error } = await supabase.
      from("orders").
      select("id, status").
      in("id", savedOrderIds);

      if (error) {
        console.error("Failed to fetch order statuses:", error);
        return;
      }

      const activeOrders = (data || []).filter(
        (order) => order.status !== "completed" && order.status !== "cancelled"
      );

      setOrderCount(Math.min(activeOrders.length, 10));
    };

    fetchActiveOrderCount();
  }, []);

  const isActive = (path: string) => {
    if (path === "/shop" && location.pathname === "/shop" && !location.search) return true;
    if (path.includes("?")) return location.pathname + location.search === path;
    return location.pathname === path;
  };

  return (
    <>
    <SaleBanner />
    {/* Top bar */}
    <header className="sticky top-0 z-40 w-full bg-card border-b border-border shadow-sm">
      {/* Main header row */}
      <div className="container flex h-14 items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-1.5 shrink-0">
          <span className="font-display text-xl font-bold tracking-tight text-foreground">LUUT</span>
          <span className="text-xs font-medium text-muted-foreground">SLU</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex">
          {mainNav.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive(item.path)
                  ? "bg-foreground/5 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          <Link to="/my-orders" className="relative">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs font-medium gap-1 h-8">
              My Orders
              {orderCount > 0 && (
                <Badge className="h-4 min-w-4 justify-center rounded-full px-1 text-[10px] bg-destructive text-white">
                  {orderCount === 10 ? "10+" : orderCount}
                </Badge>
              )}
            </Button>
          </Link>
          
          <Link to={currentUser ? "/account" : "/login"}>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-8 w-8">
              <User className="h-4 w-4" />
            </Button>
          </Link>

          {portalLink && (
            <Link to={portalLink}>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs h-8">
                Portal
              </Button>
            </Link>
          )}

          <Link to="/cart">
            <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground h-8 w-8">
              <ShoppingBag className="h-4 w-4" />
              {totalItems > 0 && (
                <Badge className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary p-0 text-[10px] text-primary-foreground">
                  {totalItems}
                </Badge>
              )}
            </Button>
          </Link>

          {/* Mobile menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 bg-card p-0 overflow-y-auto">
              <div className="flex flex-col min-h-full">
                <div className="border-b border-border p-4 sticky top-0 bg-card z-10">
                  <span className="font-display text-lg font-bold text-foreground">LUUT SLU</span>
                </div>
                
                <nav className="flex flex-col p-3 gap-0.5">
                  {mainNav.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center justify-between py-2.5 px-3 rounded-md text-sm font-medium transition-colors ${
                        isActive(item.path)
                          ? "bg-foreground/5 text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                      }`}
                    >
                      {item.label}
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                    </Link>
                  ))}
                  
                  <div className="my-3 border-t border-border" />
                  
                  <span className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Categories
                  </span>
                  {outfitCategories.map((cat) => (
                    <Link
                      key={cat.path}
                      to={cat.path}
                      onClick={() => setIsOpen(false)}
                      className="py-2 px-3 text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-foreground/5 rounded-md"
                    >
                      {cat.name}
                    </Link>
                  ))}
                  
                  <div className="my-3 border-t border-border" />
                  
                  <Link
                    to={currentUser ? "/account" : "/login"}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2 py-2.5 px-3 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md"
                  >
                    <User className="h-4 w-4" />
                    {currentUser ? "My Account" : "Sign In"}
                  </Link>
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
    </>);
}
