import { useState, useMemo } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Users, UserPlus, Crown, ShieldAlert, TrendingUp, ContactRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomerTable } from "@/components/admin/customers/CustomerTable";
import { CustomerFilters, type CustomerFiltersValue } from "@/components/admin/customers/CustomerFilters";
import { SignupsTab } from "@/components/admin/customers/SignupsTab";
import { UnclaimedCustomersTab } from "@/components/admin/customers/UnclaimedCustomersTab";
import { CustomerLoyaltyPanel } from "@/components/admin/CustomerLoyaltyPanel";
import { useAdminCustomers } from "@/hooks/useAdminCustomers";
import { useCustomerInterests } from "@/hooks/useCustomerInterests";
import { differenceInDays } from "date-fns";

const initialFilters: CustomerFiltersValue = {
  search: "",
  account: "all",
  orders: "all",
  hasDiscount: false,
  contact: "all",
  tags: [],
};

const VALID_TABS = ["directory", "claimed", "unclaimed", "spend", "loyalty", "signups"] as const;
type TabKey = typeof VALID_TABS[number];

export default function AdminCustomers() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const initialTab = (VALID_TABS as readonly string[]).includes(params.get("tab") || "")
    ? (params.get("tab") as TabKey)
    : "directory";
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [filters, setFilters] = useState<CustomerFiltersValue>(initialFilters);
  const { data: customers = [], isLoading } = useAdminCustomers();
  useCustomerInterests();

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    customers.forEach((c) => c.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [customers]);

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const hay = `${c.full_name || ""} ${c.email || ""} ${c.phone || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.account === "account" && !c.email) return false;
      if (filters.account === "guest" && c.email) return false;
      if (filters.orders === "0" && c.total_orders > 0) return false;
      if (filters.orders === "1+" && c.total_orders < 1) return false;
      if (filters.orders === "5+" && c.total_orders < 5) return false;
      if (filters.hasDiscount && !c.has_active_discount) return false;
      if (filters.contact === "never" && c.last_contacted_at) return false;
      if (filters.contact === "30d") {
        if (!c.last_contacted_at || differenceInDays(new Date(), new Date(c.last_contacted_at)) <= 30) return false;
      }
      if (filters.contact === "7d") {
        if (!c.last_contacted_at || differenceInDays(new Date(), new Date(c.last_contacted_at)) > 7) return false;
      }
      if (filters.tags.length > 0) {
        if (!filters.tags.every((t) => c.tags.includes(t))) return false;
      }
      return true;
    });
  }, [customers, filters]);

  // "Claimed" = customers with an email/account
  const claimed = useMemo(
    () => filtered.filter((c) => !!c.email),
    [filtered],
  );

  // Top spenders view (uses full customer set, ignores filters for a clean leaderboard)
  const topSpenders = useMemo(
    () => [...customers].sort((a, b) => b.total_spent - a.total_spent).slice(0, 100),
    [customers],
  );

  const stats = useMemo(() => {
    const total = customers.length;
    const withOrders = customers.filter((c) => c.total_orders > 0).length;
    const totalSpent = customers.reduce((s, c) => s + c.total_spent, 0);
    return { total, withOrders, totalSpent };
  }, [customers]);

  const onTabChange = (v: string) => {
    const next = (VALID_TABS as readonly string[]).includes(v) ? (v as TabKey) : "directory";
    setTab(next);
    const p = new URLSearchParams(params);
    p.set("tab", next);
    setParams(p, { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Admin</span>
          </Button>
          <Link to="/" className="ml-auto font-display text-base text-primary">Home</Link>
        </div>
      </header>

      <main className="container flex-1 py-4 md:py-6 max-w-6xl">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="font-display text-xl md:text-2xl">Customer Info</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            One place for accounts, unclaimed shadow profiles, spend, loyalty tiers, and signups.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <Card><CardContent className="p-3">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Total</div>
            <div className="text-lg font-semibold">{isLoading ? "…" : stats.total}</div>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wide">With orders</div>
            <div className="text-lg font-semibold">{isLoading ? "…" : stats.withOrders}</div>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Total spent</div>
            <div className="text-lg font-semibold">EC${isLoading ? "…" : stats.totalSpent.toFixed(0)}</div>
          </CardContent></Card>
        </div>

        <Tabs value={tab} onValueChange={onTabChange} className="w-full">
          <TabsList className="w-full grid grid-cols-3 md:grid-cols-6 h-auto">
            <TabsTrigger value="directory" className="gap-1.5"><ContactRound className="h-4 w-4" /> Directory</TabsTrigger>
            <TabsTrigger value="claimed" className="gap-1.5"><Users className="h-4 w-4" /> Claimed</TabsTrigger>
            <TabsTrigger value="unclaimed" className="gap-1.5"><ShieldAlert className="h-4 w-4" /> Unclaimed</TabsTrigger>
            <TabsTrigger value="spend" className="gap-1.5"><TrendingUp className="h-4 w-4" /> Spend</TabsTrigger>
            <TabsTrigger value="loyalty" className="gap-1.5"><Crown className="h-4 w-4" /> Loyalty</TabsTrigger>
            <TabsTrigger value="signups" className="gap-1.5"><UserPlus className="h-4 w-4" /> Signups</TabsTrigger>
          </TabsList>

          <TabsContent value="directory" className="mt-4 space-y-4">
            <CustomerFilters value={filters} onChange={setFilters} availableTags={availableTags} />
            {isLoading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : (
              <CustomerTable customers={filtered} />
            )}
          </TabsContent>

          <TabsContent value="claimed" className="mt-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              Customers who have signed up or claimed their account. {claimed.length} shown.
            </p>
            {isLoading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : (
              <CustomerTable customers={claimed} />
            )}
          </TabsContent>

          <TabsContent value="unclaimed" className="mt-4">
            <UnclaimedCustomersTab />
          </TabsContent>

          <TabsContent value="spend" className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">Top 100 customers by lifetime spend.</p>
            {isLoading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : (
              <CustomerTable customers={topSpenders} />
            )}
          </TabsContent>

          <TabsContent value="loyalty" className="mt-4">
            <CustomerLoyaltyPanel />
          </TabsContent>

          <TabsContent value="signups" className="mt-4">
            <SignupsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
