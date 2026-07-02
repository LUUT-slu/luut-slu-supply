import { useState, useMemo, useCallback } from "react";
import { SellerAIPanel } from "@/components/seller/SellerAIPanel";
import { useNavigate, useSearchParams } from "react-router-dom";

import { SellerNav } from "@/components/seller/SellerNav";
import { CreateOrderDialog } from "@/components/seller/CreateOrderDialog";
import { useSellerProfile } from "@/hooks/useSellerProfile";
import { useSellerOrders, ORDER_STATUSES, OrderStatus } from "@/hooks/useSellerOrders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  ShoppingBag,
  RefreshCw,
  Package,
  MessageCircle,
  Search,
  ArrowUpDown,
  MapPin,
  Calendar,
  Archive,
  Eye,
  EyeOff,
  Filter,
  CalendarIcon,
} from "lucide-react";
import { toast } from "sonner";
import { format, isToday, parseISO } from "date-fns";

type SortOption = "newest" | "pickup-soonest";
type FilterOption = "all" | OrderStatus;

// Helper to safely parse the canonical date string
function safeDisplayDate(dateStr: string): string {
  // If it's already in canonical format like "Monday, February 10, 2026", display as-is
  if (/^[A-Z][a-z]+,\s/.test(dateStr)) {
    return dateStr;
  }
  // Fallback: try to parse and format
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function safeShortDate(dateStr: string): string {
  if (/^[A-Z][a-z]+,\s/.test(dateStr)) {
    // Extract just month + day from canonical format
    const parts = dateStr.replace(/^[^,]+,\s*/, "").split(",")[0];
    return parts || dateStr;
  }
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

// Archive helpers using localStorage
function getArchivedOrders(sellerId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`luut-archived-orders-${sellerId}`);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function setArchivedOrders(sellerId: string, ids: Set<string>) {
  localStorage.setItem(`luut-archived-orders-${sellerId}`, JSON.stringify([...ids]));
}

export default function SellerOrders() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useSellerProfile();
  const { orders, loading, refetch, updateOrderStatus } = useSellerOrders(profile?.id);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  // Read filters from URL params for persistence across navigation
  const statusFilter = (searchParams.get("status") || "all") as FilterOption;
  const sortBy = (searchParams.get("sort") || "pickup-soonest") as SortOption;
  const searchQuery = searchParams.get("q") || "";
  const locationFilter = searchParams.get("location") || "all";
  const dateFilter = searchParams.get("date") || "all";
  const showArchived = searchParams.get("archived") === "1";
  const sourceFilter = searchParams.get("source") || "all";

  const [archivedIds, setArchivedIdsState] = useState<Set<string>>(() =>
    getArchivedOrders(profile?.id || "")
  );

  // Update URL params helper
  const updateParam = useCallback(
    (key: string, value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value === "all" || value === "") {
          next.delete(key);
        } else {
          next.set(key, value);
        }
        return next;
      }, { replace: true });
    },
    [setSearchParams]
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "XCD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatOrderNumber = (num: number) => `#L${String(num).padStart(4, "0")}`;

  const getStatusBadge = (status: string) => {
    const config = ORDER_STATUSES.find((s) => s.value === status) || ORDER_STATUSES[0];
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const messageCustomer = (phone: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!phone) {
      toast.error("No phone number available");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    window.open(`https://wa.me/1${cleanPhone}`, "_blank");
  };

  const toggleArchive = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile?.id) return;
    const next = new Set(archivedIds);
    if (next.has(orderId)) {
      next.delete(orderId);
    } else {
      next.add(orderId);
      toast.success("Order archived");
    }
    setArchivedIdsState(next);
    setArchivedOrders(profile.id, next);
  };

  const toggleSelectOrder = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedOrders);
    next.has(orderId) ? next.delete(orderId) : next.add(orderId);
    setSelectedOrders(next);
  };

  const handleBulkStatusChange = async (newStatus: OrderStatus) => {
    if (selectedOrders.size === 0) return;
    setBulkUpdating(true);
    const ids = Array.from(selectedOrders);
    let successCount = 0;
    for (const id of ids) {
      const ok = await updateOrderStatus(id, newStatus);
      if (ok) successCount++;
    }
    if (successCount > 0) {
      toast.success(`${successCount} order(s) updated to ${ORDER_STATUSES.find(s => s.value === newStatus)?.label || newStatus}`);
    }
    setSelectedOrders(new Set());
    setBulkUpdating(false);
  };

  // Derive unique locations and dates from orders for advanced filters
  const uniqueLocations = useMemo(() => {
    const locs = new Set(orders.map((o) => o.location));
    return [...locs].sort();
  }, [orders]);

  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    let result = [...orders];

    // Archive filter
    if (!showArchived) {
      result = result.filter((o) => !archivedIds.has(o.id));
    }

    // Source filter (website / shopify_pos / shopify_online / manual)
    if (sourceFilter !== "all") {
      if (sourceFilter === "shopify") {
        result = result.filter((o) => (o.source || "").startsWith("shopify"));
      } else {
        result = result.filter((o) => (o.source || "website") === sourceFilter);
      }
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((o) => o.status === statusFilter);
    }

    // Location filter
    if (locationFilter !== "all") {
      result = result.filter((o) => o.location === locationFilter);
    }

    // Date filter
    if (dateFilter === "today") {
      result = result.filter((o) => {
        try {
          const d = new Date(o.preferred_date);
          return !isNaN(d.getTime()) && isToday(d);
        } catch {
          return false;
        }
      });
    } else if (dateFilter !== "all") {
      // Specific date selected from calendar
      result = result.filter((o) => {
        try {
          const orderDate = format(new Date(o.preferred_date), "yyyy-MM-dd");
          return orderDate === dateFilter;
        } catch {
          return false;
        }
      });
    }

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (o) =>
          o.customer_name.toLowerCase().includes(query) ||
          formatOrderNumber(o.order_number).toLowerCase().includes(query) ||
          o.items.some((i) => i.product_name.toLowerCase().includes(query))
      );
    }

    // Separate completed/no-show/cancelled to the bottom
    const terminalStatuses = new Set(["completed", "no-show", "cancelled"]);
    const active = result.filter((o) => !terminalStatuses.has(o.status));
    const terminal = result.filter((o) => terminalStatuses.has(o.status));

    // Sort active orders
    if (sortBy === "newest") {
      active.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === "pickup-soonest") {
      active.sort(
        (a, b) => new Date(a.preferred_date).getTime() - new Date(b.preferred_date).getTime()
      );
    }

    // Sort terminal by most recently completed
    terminal.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return [...active, ...terminal];
  }, [orders, statusFilter, searchQuery, sortBy, locationFilter, dateFilter, showArchived, archivedIds, sourceFilter]);

  // Stats
  const stats = useMemo(() => {
    const completed = orders.filter((o) => o.status === "completed");
    const revenue = completed.reduce((sum, o) => sum + o.total_price, 0);
    const pending = orders.filter((o) => o.status === "pending" || o.status === "confirmed").length;
    return { revenue, completed: completed.length, pending, total: orders.length };
  }, [orders]);

  return (
    <>
      <div className="flex min-h-screen flex-col bg-background">
        <SellerNav
          sellerName={profile?.seller_name}
          logoUrl={profile?.logo_url || undefined}
          sellerId={profile?.id}
        />

        <main className="container flex-1 py-4 md:py-6">
          {/* Header */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-xl md:text-2xl">Orders</h1>
              <p className="text-xs text-muted-foreground">
                {stats.completed} completed · {formatCurrency(stats.revenue)} revenue ·{" "}
                {stats.pending} pending
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={refetch} variant="outline" size="sm" className="gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              {profile?.id && (
                <CreateOrderDialog
                  sellerId={profile.id}
                  sellerName={profile.seller_name}
                  sellerWhatsapp={profile.whatsapp}
                  onOrderCreated={refetch}
                />
              )}
            </div>
          </div>

          {/* Source chips */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {[
              { value: "all", label: "All Orders" },
              { value: "website", label: "Website" },
              { value: "shopify_pos", label: "Shopify POS" },
              { value: "shopify_online", label: "Shopify Online" },
              { value: "manual", label: "Manual" },
            ].map((s) => (
              <Button
                key={s.value}
                size="sm"
                variant={sourceFilter === s.value ? "secondary" : "ghost"}
                className="h-7 text-xs px-2.5"
                onClick={() => updateParam("source", s.value)}
              >
                {s.label}
              </Button>
            ))}
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => updateParam("q", e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => updateParam("status", v)}>
              <SelectTrigger className="w-28 h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {ORDER_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={locationFilter} onValueChange={(v) => updateParam("location", v)}>
              <SelectTrigger className="w-32 h-9">
                <MapPin className="h-3.5 w-3.5 mr-1" />
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {uniqueLocations.map((loc) => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 gap-1.5 min-w-[120px] justify-start", dateFilter !== "all" && "text-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateFilter === "all" ? "All Dates" : dateFilter === "today" ? "Today" : format(new Date(dateFilter), "MMM d")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="flex gap-1 p-2 border-b">
                  <Button variant={dateFilter === "all" ? "secondary" : "ghost"} size="sm" className="text-xs h-7" onClick={() => updateParam("date", "all")}>All</Button>
                  <Button variant={dateFilter === "today" ? "secondary" : "ghost"} size="sm" className="text-xs h-7" onClick={() => updateParam("date", "today")}>Today</Button>
                </div>
                <CalendarComponent
                  mode="single"
                  selected={dateFilter !== "all" && dateFilter !== "today" ? new Date(dateFilter) : undefined}
                  onSelect={(d) => d ? updateParam("date", format(d, "yyyy-MM-dd")) : updateParam("date", "all")}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Select value={sortBy} onValueChange={(v) => updateParam("sort", v)}>
              <SelectTrigger className="w-36 h-9">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="pickup-soonest">Pickup Soonest</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={showArchived ? "secondary" : "ghost"}
              size="sm"
              className="h-9 gap-1"
              onClick={() => updateParam("archived", showArchived ? "" : "1")}
            >
              {showArchived ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{showArchived ? "Showing All" : "Show Archived"}</span>
            </Button>
          </div>

          {/* Bulk Actions Bar */}
          {selectedOrders.size > 0 && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2">
              <span className="text-xs font-medium">{selectedOrders.size} selected</span>
              <Select onValueChange={(v) => handleBulkStatusChange(v as OrderStatus)} disabled={bulkUpdating}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue placeholder="Change status..." />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setSelectedOrders(new Set())}>
                Clear
              </Button>
            </div>
          )}

          {/* Orders List */}
          <div className="rounded-lg border border-border/60 bg-card/50">
            {loading ? (
              <div className="p-4"><ListItemSkeleton rows={5} /></div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ShoppingBag className="mb-4 h-10 w-10 text-muted-foreground" />
                <h3 className="font-medium text-sm">
                  {orders.length === 0 ? "No orders yet" : "No orders match your filters"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {orders.length === 0
                    ? "Orders will appear here when customers purchase your products"
                    : "Try adjusting your search or filters"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {filteredOrders.map((order) => {
                  const isArchived = archivedIds.has(order.id);
                  return (
                    <div
                      key={order.id}
                      className={`p-3 md:p-4 cursor-pointer active:bg-muted/40 transition-colors ${isArchived ? "opacity-60" : ""} ${selectedOrders.has(order.id) ? "bg-primary/5" : ""}`}
                      onClick={() => navigate(`/seller/orders/${order.id}`)}
                    >
                      {/* Mobile-first card layout */}
                      <div className="flex items-start justify-between gap-3">
                        {/* Checkbox */}
                        <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedOrders.has(order.id)}
                            onCheckedChange={() => { const next = new Set(selectedOrders); next.has(order.id) ? next.delete(order.id) : next.add(order.id); setSelectedOrders(next); }}
                          />
                        </div>
                        {/* Left: Customer + Items */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm truncate">{order.customer_name}</p>
                            {getStatusBadge(order.status)}
                            {order.source === "shopify_pos" && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 border-purple-500/40 text-purple-600">POS Sale</Badge>
                            )}
                            {order.source === "shopify_online" && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 border-blue-500/40 text-blue-600">Shopify</Badge>
                            )}
                          </div>
                          {order.customer_phone && (
                            <p className="text-xs text-muted-foreground mb-1">{order.customer_phone}</p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {order.items[0]?.product_image_url ? (
                              <img
                                src={order.items[0].product_image_url}
                                alt=""
                                className="h-6 w-6 rounded object-cover"
                              />
                            ) : (
                              <Package className="h-4 w-4" />
                            )}
                            <span className="truncate">
                              {order.items.length === 1
                                ? order.items[0].product_name
                                : `${order.items.length} items`}
                            </span>
                          </div>
                        </div>

                        {/* Right: Price + Order # */}
                        <div className="text-right shrink-0">
                          <p className="font-medium text-sm text-primary">
                            {formatCurrency(order.total_price)}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatOrderNumber(order.order_number)}
                          </p>
                        </div>
                      </div>

                      {/* Bottom row: Pickup + Location + Actions */}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/20">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {safeShortDate(order.preferred_date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {order.location}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={(e) => messageCustomer(order.customer_phone, e)}
                            disabled={!order.customer_phone}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={(e) => toggleArchive(order.id, e)}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
      <SellerAIPanel defaultMode="order" />
    </>
  );
}
