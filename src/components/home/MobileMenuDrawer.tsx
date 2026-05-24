import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles, Flame, Store, ShoppingBag, Package, Heart, Clock, MapPin,
  Ticket, MessageCircle, Building2, UserPlus, LayoutDashboard, Gift,
  Info, Truck, HelpCircle, Mail, ShoppingCart, Bell, User as UserIcon,
  ChevronRight, Sparkle, LogOut, LogIn,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useCartStore } from "@/stores/cartStore";
import { useShopifyCollections, getCollectionPath } from "@/hooks/useShopifyCollections";
import { useBestSellersUnified } from "@/hooks/useBestSellersUnified";
import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { LocaleSelector } from "@/components/locale/LocaleSelector";
import { useLocaleStore } from "@/stores/localeStore";
import { flagEmoji, getCurrency, getLanguage } from "@/lib/localization";
import { Globe } from "lucide-react";

interface MobileMenuDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Lightweight emoji-style icon map for Shopify collections
const collectionIcon: Record<string, string> = {
  bags: "👜", beanies: "🧢", belt: "🪢", belts: "🪢",
  electronics: "🎧", eyewear: "🕶️", facewear: "😷",
  hats: "🎩", shoes: "👟", shirts: "👕", hoodies: "🧥",
  jackets: "🧥", pants: "👖", shorts: "🩳", boxers: "🩲",
  slippers: "🩴", sandals: "🩴", socks: "🧦", accessories: "✨",
};

function iconForCollection(handle: string) {
  return collectionIcon[handle.toLowerCase()] ?? "🛍️";
}

interface RowProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  hint?: string;
  badge?: React.ReactNode;
  onClick?: () => void;
}

function Row({ to, icon, label, hint, badge, onClick }: RowProps) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-all active:scale-[0.98] active:bg-primary/10 hover:bg-primary/5 touch-manipulation"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 group-hover:bg-primary/15 transition-colors">
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-medium text-foreground leading-tight truncate">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground truncate mt-0.5">{hint}</span>}
      </span>
      {badge ?? <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-5 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary/70">
      {children}
    </div>
  );
}

export function MobileMenuDrawer({ open, onOpenChange }: MobileMenuDrawerProps) {
  const totalItems = useCartStore((s) => s.getTotalItems());
  const { collections } = useShopifyCollections(30);
  const { products: bestSellers } = useBestSellersUnified(8);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [orderCount, setOrderCount] = useState(0);
  const localeCountry = useLocaleStore((s) => s.country);
  const localeLanguage = useLocaleStore((s) => s.language);
  const localeCurrency = useLocaleStore((s) => s.currency);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) { setDisplayName(""); return; }
    const meta = (user.user_metadata || {}) as Record<string, unknown>;
    const name = (meta.full_name as string) || (meta.name as string) || user.email?.split("@")[0] || "";
    setDisplayName(name);
  }, [user]);

  useEffect(() => {
    const ids = JSON.parse(localStorage.getItem("luut-my-orders") || "[]");
    setOrderCount(Array.isArray(ids) ? ids.length : 0);
  }, [open]);

  const close = () => onOpenChange(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    close();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[88vw] max-w-[380px] border-r border-primary/20 bg-background/95 backdrop-blur-xl p-0 overflow-y-auto overflow-x-hidden"
      >
        <div className="flex flex-col min-h-full">
          {/* Top: Brand + quick actions */}
          <div className="relative overflow-hidden border-b border-primary/15 px-5 pt-6 pb-5 bg-gradient-to-br from-primary/15 via-background to-background">
            <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
            <div className="relative flex items-start justify-between">
              <div>
                <Link to="/" onClick={close} className="block">
                  <span className="font-display text-2xl font-bold tracking-[0.22em] text-primary">LUUT SLU</span>
                </Link>
                <p className="mt-2 text-xs text-muted-foreground">
                  {user ? `Welcome back, ${displayName || "friend"}` : "Welcome — browse the latest drops"}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Link
                  to={user ? "/account" : "/login"}
                  onClick={close}
                  aria-label="Account"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20 text-primary active:scale-95 transition"
                >
                  <UserIcon className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  aria-label="Notifications"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20 text-primary active:scale-95 transition"
                >
                  <Bell className="h-4 w-4" />
                </button>
                <Link
                  to="/cart"
                  onClick={close}
                  aria-label="Cart"
                  className="relative flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-95 transition"
                >
                  <ShoppingCart className="h-4 w-4" />
                  {totalItems > 0 && (
                    <Badge className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground p-0 px-1 text-[9px] font-bold text-background">
                      {totalItems > 9 ? "9+" : totalItems}
                    </Badge>
                  )}
                </Link>
              </div>
            </div>

            {/* Account status card */}
            <div className="relative mt-5 rounded-2xl border border-primary/20 bg-background/60 backdrop-blur p-3.5 shadow-[0_4px_24px_-8px_hsl(var(--primary)/0.3)]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground font-bold">
                  {(displayName || user?.email || "L")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {user ? displayName || "Luut Member" : "Guest"}
                  </p>
                  <p className="text-[10px] text-primary/80 font-medium tracking-wider uppercase flex items-center gap-1">
                    <Sparkle className="h-2.5 w-2.5" /> LUUT Member
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-primary/5 py-2">
                  <p className="text-base font-bold text-foreground">{orderCount}</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Orders</p>
                </div>
                <div className="rounded-lg bg-primary/5 py-2">
                  <p className="text-base font-bold text-foreground">{totalItems}</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">In Cart</p>
                </div>
                <div className="rounded-lg bg-primary/5 py-2">
                  <p className="text-base font-bold text-primary">0</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Points</p>
                </div>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-2 pb-4">
            {/* Main */}
            <SectionLabel>Explore</SectionLabel>
            <Row to="/shop" icon={<ShoppingBag className="h-4 w-4" />} label="Shop All" hint="Browse the full catalog" onClick={close} />
            <Row to="/shop?filter=new" icon={<Sparkles className="h-4 w-4" />} label="New Arrivals" hint="Fresh drops this week" onClick={close} />
            <Row to="/shop?filter=best" icon={<Flame className="h-4 w-4" />} label="Best Sellers" hint="Most loved by buyers" onClick={close} />
            <Row to="/sellers" icon={<Store className="h-4 w-4" />} label="Sellers" hint="Discover local vendors" onClick={close} />

            {/* Best seller preview */}
            {bestSellers.length > 0 && (
              <div className="mt-4 px-1">
                <div className="flex items-center justify-between px-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/70">Trending Now</span>
                  <Link to="/shop?filter=best" onClick={close} className="text-[10px] font-medium text-primary">See all</Link>
                </div>
                <div className="-mx-1 flex gap-2.5 overflow-x-auto pb-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {bestSellers.slice(0, 6).map((p) => {
                    const to = p.source === "shopify" ? `/product/${p.handle}` : `/p/${p.id}`;
                    const img = p.images?.[0]?.url;
                    return (
                      <Link
                        key={p.id}
                        to={to}
                        onClick={close}
                        className="group flex-shrink-0 w-24"
                      >
                        <div className="relative aspect-square overflow-hidden rounded-xl bg-muted ring-1 ring-primary/10">
                          {img ? (
                            <img
                              src={img}
                              alt={p.title}
                              loading="lazy"
                              className="h-full w-full object-cover transition-transform group-active:scale-95"
                            />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-primary/10 to-primary/5" />
                          )}
                        </div>
                        <p className="mt-1.5 text-[11px] font-medium text-foreground line-clamp-1">{p.title}</p>
                        <p className="text-[10px] text-primary font-semibold">
                          {p.price.currencyCode === "XCD" ? "EC$" : "$"}{Number(p.price.amount).toFixed(2)}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Shop by Category (Shopify collections) */}
            <SectionLabel>Shop by Category</SectionLabel>
            <Accordion type="single" collapsible defaultValue="cats" className="px-1">
              <AccordionItem value="cats" className="border-0">
                <AccordionTrigger className="rounded-xl px-3 py-2.5 hover:no-underline hover:bg-primary/5 [&[data-state=open]]:bg-primary/5">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span className="text-base">🗂️</span>
                    {collections.length} collections
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-1">
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    {collections.map((c) => (
                      <Link
                        key={c.id}
                        to={getCollectionPath(c.handle)}
                        onClick={close}
                        className="flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2.5 active:scale-95 transition-all"
                      >
                        <span className="text-lg">{iconForCollection(c.handle)}</span>
                        <span className="text-xs font-medium text-foreground truncate">{c.title}</span>
                      </Link>
                    ))}
                    {collections.length === 0 && (
                      <p className="col-span-2 px-3 py-2 text-xs text-muted-foreground">Loading collections…</p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Quick access */}
            <SectionLabel>Quick Access</SectionLabel>
            <Row to="/my-orders" icon={<Package className="h-4 w-4" />} label="My Orders" onClick={close}
              badge={orderCount > 0 ? <Badge className="bg-primary/15 text-primary border-0">{orderCount}</Badge> : undefined} />
            <Row to="/account?tab=wishlist" icon={<Heart className="h-4 w-4" />} label="Wishlist" hint="Saved for later" onClick={close} />
            <Row to="/shop" icon={<Clock className="h-4 w-4" />} label="Recently Viewed" onClick={close} />
            <Row to="/my-orders" icon={<MapPin className="h-4 w-4" />} label="Track Order" onClick={close} />
            <Row to="/account?tab=coupons" icon={<Ticket className="h-4 w-4" />} label="Coupons & Offers" onClick={close} />
            <Row to="/contact" icon={<MessageCircle className="h-4 w-4" />} label="Support Chat" onClick={close} />

            {/* Marketplace */}
            <SectionLabel>Marketplace</SectionLabel>
            <Row to="/sell" icon={<Building2 className="h-4 w-4" />} label="Sell on Luut" hint="List your products" onClick={close} />
            <Row to="/sell" icon={<UserPlus className="h-4 w-4" />} label="Become a Seller" onClick={close} />
            <Row to="/seller" icon={<LayoutDashboard className="h-4 w-4" />} label="Vendor Dashboard" onClick={close} />
            <Row to="/sell" icon={<Gift className="h-4 w-4" />} label="Affiliate Program" hint="Coming soon" onClick={close} />

            {/* Info */}
            <SectionLabel>Luut Info</SectionLabel>
            <Row to="/sellers" icon={<Info className="h-4 w-4" />} label="About Luut" onClick={close} />
            <Row to="/meetup-policy" icon={<Truck className="h-4 w-4" />} label="Delivery & Meetups" onClick={close} />
            <Row to="/contact" icon={<HelpCircle className="h-4 w-4" />} label="FAQ" onClick={close} />
            <Row to="/contact" icon={<Mail className="h-4 w-4" />} label="Contact Us" onClick={close} />

            {/* Region & Language */}
            <SectionLabel>Region & Language</SectionLabel>
            <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 hover:bg-primary/5">
              <span className="flex items-center gap-3 min-w-0">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                  <Globe className="h-4 w-4" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-medium text-foreground leading-tight">Region & Language</span>
                  <span className="block text-[11px] text-muted-foreground truncate mt-0.5">
                    {flagEmoji(useLocaleStore.getState().country)} {useLocaleStore.getState().country} · {getLanguage(useLocaleStore.getState().language)?.endonym ?? useLocaleStore.getState().language.toUpperCase()} · {getCurrency(useLocaleStore.getState().currency)?.symbol ?? useLocaleStore.getState().currency}
                  </span>
                </span>
              </span>
              <LocaleSelector />
            </div>


            {/* Auth */}
            <div className="mt-5 px-3">
              {user ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-background py-3 text-sm font-medium text-foreground active:scale-[0.98] transition"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              ) : (
                <Link
                  to="/login"
                  onClick={close}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground",
                    "active:scale-[0.98] transition shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.6)]"
                  )}
                >
                  <LogIn className="h-4 w-4" /> Sign in / Create account
                </Link>
              )}
              <p className="mt-4 text-center text-[10px] text-muted-foreground tracking-wider">
                LUUT SLU · Saint Lucia's Marketplace
              </p>
            </div>
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}
