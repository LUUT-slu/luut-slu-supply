import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  BarChart3,
  LogOut,
  Home,
  Plus,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface SellerNavProps {
  sellerName?: string;
  logoUrl?: string;
  sellerId?: string;
}

export function SellerNav({ sellerName, logoUrl, sellerId }: SellerNavProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/", { replace: true });
  };

  const navItems = [
    { href: "/seller/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/seller/products", icon: Package, label: "Products" },
    { href: "/seller/orders", icon: ShoppingBag, label: "Orders" },
    { href: "/seller/analytics", icon: BarChart3, label: "Analytics" },
  ];

  const isActive = (href: string) => location.pathname === href;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        {/* Logo / Brand */}
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={sellerName || "Seller"}
              className="h-8 w-8 rounded-full object-cover border border-border"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Package className="h-4 w-4 text-primary" />
            </div>
          )}
          <span className="font-display text-lg tracking-wide hidden sm:block">
            {sellerName || "Seller Portal"}
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <item.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/seller/products/new")}
            className="gap-1.5 text-xs hidden sm:flex"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Product
          </Button>
          {sellerId && (
            <Link
              to={`/seller/${sellerId}`}
              target="_blank"
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              title="View public profile"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
          <Link
            to="/"
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Home className="h-3.5 w-3.5" />
          </Link>
          <Button
            onClick={handleLogout}
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
