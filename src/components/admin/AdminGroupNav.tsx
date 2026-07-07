import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  ClipboardList,
  Truck,
  Package,
  BarChart3,
  UserCheck,
  Store,
  Image as ImageIcon,
  MessageSquare,
  Tag,
  Megaphone,
  Images,
  Percent,
  BellRing,
  Wifi,
  TrendingUp,
} from "lucide-react";

type GroupKey = "fulfillment" | "roster" | "catalog" | "marketing" | "insights";

type Tab = { label: string; href: string; icon: React.ComponentType<{ className?: string }> };

const GROUPS: Record<GroupKey, { title: string; tabs: Tab[] }> = {
  fulfillment: {
    title: "Orders & Fulfillment",
    tabs: [
      { label: "Customer Orders", href: "/admin/orders", icon: ClipboardList },
      { label: "Dispatch", href: "/connect", icon: Truck },
      { label: "Purchase Orders", href: "/admin/purchase-orders", icon: Package },
      { label: "Reports", href: "/admin/purchase-orders/reports", icon: BarChart3 },
    ],
  },
  roster: {
    title: "Sellers & Partners",
    tabs: [
      { label: "Approvals", href: "/admin/approvals", icon: UserCheck },
      { label: "Verified Sellers", href: "/admin/sellers", icon: Store },
      { label: "Delivery Partners", href: "/admin/partners", icon: Truck },
    ],
  },
  catalog: {
    title: "Catalog",
    tabs: [
      { label: "Products", href: "/admin/products", icon: Package },
      { label: "Category Images", href: "/admin/category-images", icon: ImageIcon },
      { label: "Reviews", href: "/admin/reviews", icon: MessageSquare },
    ],
  },
  marketing: {
    title: "Marketing",
    tabs: [
      { label: "Promotions", href: "/admin/promotions", icon: Tag },
      { label: "Studio", href: "/admin/marketing-studio", icon: Megaphone },
      { label: "Content Library", href: "/admin/content-library", icon: Images },
      { label: "Discounts", href: "/admin/discounts", icon: Percent },
      { label: "Popups", href: "/admin/popups", icon: BellRing },
    ],
  },
  insights: {
    title: "Analytics & Health",
    tabs: [
      { label: "Analytics", href: "/admin/analytics", icon: TrendingUp },
      { label: "Connection Health", href: "/admin/connection-health", icon: Wifi },
    ],
  },
};

interface Props {
  group: GroupKey;
  className?: string;
}

export function AdminGroupNav({ group, className }: Props) {
  const location = useLocation();
  const cfg = GROUPS[group];
  if (!cfg) return null;

  const isActive = (href: string) => {
    if (href === "/admin/purchase-orders/reports") {
      return location.pathname === href;
    }
    if (href === "/admin/purchase-orders") {
      return (
        location.pathname === href ||
        (location.pathname.startsWith("/admin/purchase-orders/") &&
          location.pathname !== "/admin/purchase-orders/reports")
      );
    }
    return location.pathname === href;
  };

  return (
    <div
      className={cn(
        "sticky top-14 z-30 w-full border-b border-border/60 bg-background/95 backdrop-blur",
        className,
      )}
    >
      <div className="container flex items-center gap-1 overflow-x-auto py-1.5">
        <span className="mr-2 shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {cfg.title}
        </span>
        {cfg.tabs.map((t) => {
          const active = isActive(t.href);
          return (
            <Link
              key={t.href}
              to={t.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
