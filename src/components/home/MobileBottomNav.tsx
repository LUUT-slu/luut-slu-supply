import { Link, useLocation } from "react-router-dom";
import { Home, LayoutGrid, Package, Heart, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Home", icon: Home, to: "/", match: (p: string) => p === "/" },
  { label: "Categories", icon: LayoutGrid, to: "/shop", match: (p: string) => p.startsWith("/shop") || p.startsWith("/c/") },
  { label: "Orders", icon: Package, to: "/my-orders", match: (p: string) => p.startsWith("/my-orders") || p.startsWith("/order") },
  { label: "Favourites", icon: Heart, to: "/account?tab=favourites", match: (p: string, s: string) => s.includes("favourites") },
  { label: "Account", icon: User, to: "/account", match: (p: string) => p.startsWith("/account") || p.startsWith("/login") },
];

export function MobileBottomNav() {
  const location = useLocation();
  return (
    <nav
      aria-label="Bottom navigation"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/40 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/65 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-16 items-stretch justify-around">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.match(location.pathname, location.search);
          return (
            <Link
              key={tab.label}
              to={tab.to}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors touch-manipulation",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "fill-primary/10")} strokeWidth={isActive ? 2.4 : 2} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
