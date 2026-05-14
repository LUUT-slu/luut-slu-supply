import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Pencil,
  BadgeCheck,
  Crown,
  ShieldCheck,
  Handshake,
  Lock,
  ShoppingBag,
  CalendarCheck,
  Receipt,
  Star,
  MessageSquareText,
  Heart,
  Ticket,
  Link as LinkIcon,
  ChevronRight,
  Image as ImageIcon,
  User as UserIcon,
  Smartphone,
  Mail,
  Tag,
  Instagram,
  Music2,
  Store,
  Truck,
  ShieldAlert,
  LogOut,
  X,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import type { User as SupabaseUser } from "@supabase/supabase-js";

type AccountType = "member" | "seller" | "partner" | "admin";

interface CustomerProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  preferred_location: string | null;
  meetup_notes: string | null;
  avatar_url: string | null;
  instagram_url?: string | null;
  tiktok_url?: string | null;
  favorite_categories?: string[] | null;
}

const QUICK_ACTIONS: {
  key: string;
  label: string;
  Icon: typeof ShoppingBag;
  to?: string;
  comingSoon?: boolean;
}[] = [
  { key: "orders", label: "My Orders", Icon: ShoppingBag, to: "/my-orders" },
  { key: "preorders", label: "Pre Orders", Icon: CalendarCheck, comingSoon: true },
  { key: "history", label: "Purchase History", Icon: Receipt, to: "/my-orders?status=completed" },
  { key: "to-review", label: "To Review", Icon: Star, to: "/my-orders?filter=to-review" },
  { key: "my-reviews", label: "My Reviews", Icon: MessageSquareText, comingSoon: true },
  { key: "favourites", label: "My Favourites", Icon: Heart, comingSoon: true },
  { key: "coupons", label: "My Coupons", Icon: Ticket, comingSoon: true },
  { key: "affiliate", label: "Affiliate Link", Icon: LinkIcon, comingSoon: true },
];

function getInitials(name?: string | null, email?: string | null) {
  const src = (name || email || "L").trim();
  const parts = src.split(/\s+/);
  return ((parts[0]?.[0] ?? "L") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function AccountSettings() {
  const navigate = useNavigate();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const [sellerProfile, setSellerProfile] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // editing modal
  const [editField, setEditField] = useState<null | {
    key: keyof CustomerProfile | "favorite_categories";
    label: string;
    type: "text" | "email" | "tel" | "textarea" | "list";
  }>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) navigate("/login");
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) navigate("/login");
      else fetchAll(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchAll = async (userId: string) => {
    setIsLoading(true);
    const [{ data: cp }, { data: pp }, { data: sp }, { data: roles }] = await Promise.all([
      supabase.from("customer_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("partner_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("seller_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setProfile(cp as any);
    setPartnerProfile(pp);
    setSellerProfile(sp);
    setIsAdmin((roles ?? []).some((r: any) => r.role === "admin"));
    setIsLoading(false);
  };

  const accountTypes = useMemo(() => {
    const sellerActive = !!sellerProfile?.is_approved;
    const partnerActive = partnerProfile?.status === "approved";
    return [
      { key: "member" as AccountType, label: "Luut Member", Icon: Crown, active: true },
      { key: "seller" as AccountType, label: "Verified Seller", Icon: ShieldCheck, active: sellerActive },
      { key: "partner" as AccountType, label: "Partner", Icon: Handshake, active: partnerActive },
      { key: "admin" as AccountType, label: "Admin", Icon: Lock, active: isAdmin },
    ];
  }, [sellerProfile, partnerProfile, isAdmin]);

  const displayName =
    profile?.full_name?.trim() ||
    user?.email?.split("@")[0] ||
    "Luut Member";

  const openEdit = (
    key: keyof CustomerProfile | "favorite_categories",
    label: string,
    type: "text" | "email" | "tel" | "textarea" | "list",
  ) => {
    let v: any = (profile as any)?.[key];
    if (type === "list") v = Array.isArray(v) ? v.join(", ") : "";
    setEditField({ key, label, type });
    setEditValue(v ?? "");
  };

  const saveEdit = async () => {
    if (!editField || !user) return;
    setSaving(true);
    const value =
      editField.type === "list"
        ? editValue
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : editValue.trim() || null;

    const { error } = await supabase
      .from("customer_profiles")
      .update({ [editField.key]: value as any })
      .eq("user_id", user.id);

    setSaving(false);
    if (error) {
      toast.error("Could not save");
      return;
    }
    setProfile((p) => (p ? ({ ...p, [editField.key]: value } as any) : p));
    toast.success("Saved");
    setEditField(null);
  };

  const handleQuickAction = (a: (typeof QUICK_ACTIONS)[number]) => {
    if (a.comingSoon) {
      toast.info(`${a.label} — coming soon`);
      return;
    }
    if (a.to) navigate(a.to);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 container py-8 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading your account...</div>
        </main>
        <Footer />
      </div>
    );
  }

  const personalizeRows: {
    key: keyof CustomerProfile | "favorite_categories";
    label: string;
    Icon: typeof UserIcon;
    value: string;
    type: "text" | "email" | "tel" | "textarea" | "list";
  }[] = [
    {
      key: "avatar_url",
      label: "Photo",
      Icon: ImageIcon,
      value: profile?.avatar_url ? "Uploaded" : "Add photo",
      type: "text",
    },
    {
      key: "full_name",
      label: "Display Name",
      Icon: UserIcon,
      value: profile?.full_name || "Not set",
      type: "text",
    },
    {
      key: "phone",
      label: "Mobile",
      Icon: Smartphone,
      value: profile?.phone || "Not set",
      type: "tel",
    },
    {
      key: "email",
      label: "Contact Email",
      Icon: Mail,
      value: profile?.email || user?.email || "Not set",
      type: "email",
    },
    {
      key: "favorite_categories",
      label: "Favorite Categories",
      Icon: Tag,
      value:
        profile?.favorite_categories && profile.favorite_categories.length > 0
          ? `${profile.favorite_categories.length} selected`
          : "Not set",
      type: "list",
    },
    {
      key: "instagram_url",
      label: "Instagram",
      Icon: Instagram,
      value: profile?.instagram_url || "Not set",
      type: "text",
    },
    {
      key: "tiktok_url",
      label: "TikTok",
      Icon: Music2,
      value: profile?.tiktok_url || "Not set",
      type: "text",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 container max-w-2xl py-6 md:py-10 space-y-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
        </Button>

        {/* Profile Header */}
        <section className="flex items-center gap-4">
          <div className="relative h-16 w-16 rounded-full ring-1 ring-primary/30 bg-card flex items-center justify-center overflow-hidden shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <span className="font-display text-primary text-lg">
                {getInitials(profile?.full_name, user?.email)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl truncate">{displayName}</h1>
              <BadgeCheck className="h-5 w-5 text-primary fill-primary/20 shrink-0" />
            </div>
            <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="rounded-full border-border h-10 w-10 shrink-0"
            onClick={() => openEdit("full_name", "Display Name", "text")}
            aria-label="Edit profile"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </section>

        {/* Account Type Card */}
        <section className="rounded-2xl border border-primary/30 bg-gradient-to-b from-primary/10 to-transparent p-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/15 ring-1 ring-primary/40 flex items-center justify-center shrink-0">
              <Crown className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-lg text-primary">Luut Member</h2>
                <Badge className="bg-primary/15 text-primary hover:bg-primary/15 border border-primary/40 gap-1">
                  <Star className="h-3 w-3 fill-primary" /> Active
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Enjoy member access, saved preferences, faster ordering, and Luut SLU updates.
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-primary/15 grid grid-cols-3 gap-2">
            {accountTypes.slice(1).map(({ key, label, Icon, active }) => (
              <div
                key={key}
                className={`flex items-center justify-center gap-1.5 text-xs ${
                  active ? "text-primary" : "text-muted-foreground/60"
                }`}
                title={active ? `${label} — Active` : `${label} — locked`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="truncate">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Actions Grid */}
        <section className="rounded-2xl border border-border bg-card p-2">
          <div className="grid grid-cols-4 divide-x divide-border">
            {QUICK_ACTIONS.slice(0, 4).map(({ key, label, Icon, ...a }) => (
              <button
                key={key}
                onClick={() => handleQuickAction({ key, label, Icon, ...a })}
                className="flex flex-col items-center gap-1.5 py-4 px-1 hover:bg-muted/30 active:bg-muted/50 transition-colors touch-manipulation"
              >
                <Icon className="h-6 w-6 text-primary" strokeWidth={1.6} />
                <span className="text-[11px] font-medium text-foreground text-center leading-tight">
                  {label}
                </span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 divide-x divide-border border-t border-border">
            {QUICK_ACTIONS.slice(4).map(({ key, label, Icon, ...a }) => (
              <button
                key={key}
                onClick={() => handleQuickAction({ key, label, Icon, ...a })}
                className="flex flex-col items-center gap-1.5 py-4 px-1 hover:bg-muted/30 active:bg-muted/50 transition-colors touch-manipulation"
              >
                <Icon className="h-6 w-6 text-primary" strokeWidth={1.6} />
                <span className="text-[11px] font-medium text-foreground text-center leading-tight">
                  {label}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Account Personalize */}
        <section className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-primary" />
              <h2 className="font-display text-base">Account Personalize</h2>
            </div>
            <button
              onClick={() => openEdit("full_name", "Display Name", "text")}
              className="text-primary text-sm font-medium flex items-center gap-1 hover:opacity-80"
            >
              Edit All <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="divide-y divide-border">
            {personalizeRows.map((row) => (
              <button
                key={row.key as string}
                onClick={() => openEdit(row.key, row.label, row.type)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/20 active:bg-muted/40 transition-colors text-left touch-manipulation"
              >
                <row.Icon className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm text-foreground flex-1">{row.label}</span>
                <span className="text-sm text-muted-foreground truncate max-w-[45%]">
                  {row.value}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </section>

        {/* Business Access */}
        {(sellerProfile?.is_approved || partnerProfile?.status === "approved" || isAdmin) && (
          <section className="space-y-2">
            <h2 className="font-display text-sm uppercase tracking-wider text-muted-foreground px-1">
              Business Access
            </h2>
            <div className="space-y-2">
              {sellerProfile?.is_approved && (
                <Link
                  to="/seller"
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary/40 transition-colors"
                >
                  <Store className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground">Seller Portal</div>
                    <div className="text-xs text-muted-foreground">
                      Manage your products and store
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-primary shrink-0" />
                </Link>
              )}
              {partnerProfile?.status === "approved" && (
                <Link
                  to="/partner"
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary/40 transition-colors"
                >
                  <Truck className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground">Partner Dashboard</div>
                    <div className="text-xs text-muted-foreground">Manage partner activity</div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-primary shrink-0" />
                </Link>
              )}
              {isAdmin && (
                <Link
                  to="/admin"
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary/40 transition-colors"
                >
                  <ShieldAlert className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground">Admin Dashboard</div>
                    <div className="text-xs text-muted-foreground">Manage platform operations</div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-primary shrink-0" />
                </Link>
              )}
            </div>
          </section>
        )}

        {/* Logout */}
        <section className="pt-2">
          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full text-destructive hover:text-destructive border-border"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </section>
      </main>
      <Footer />

      {/* Edit Field Dialog */}
      <Dialog open={!!editField} onOpenChange={(o) => !o && setEditField(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Edit {editField?.label}</DialogTitle>
            {editField?.type === "list" && (
              <DialogDescription>Separate categories with commas</DialogDescription>
            )}
          </DialogHeader>
          {editField?.type === "textarea" ? (
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              rows={4}
              autoFocus
            />
          ) : (
            <Input
              type={editField?.type === "email" ? "email" : editField?.type === "tel" ? "tel" : "text"}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={editField?.label}
              autoFocus
            />
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditField(null)} disabled={saving}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
            <Button onClick={saveEdit} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
