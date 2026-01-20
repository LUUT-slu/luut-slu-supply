import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SellerRouteGuard } from "@/components/seller/SellerRouteGuard";
import { SellerNav } from "@/components/seller/SellerNav";
import { CreateOrderDialog } from "@/components/seller/CreateOrderDialog";
import { useSellerProfile } from "@/hooks/useSellerProfile";
import { useSellerOrders, ORDER_STATUSES, OrderStatus } from "@/hooks/useSellerOrders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShoppingBag,
  RefreshCw,
  Package,
  Eye,
  MessageCircle,
  Pencil,
  Search,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";

type SortOption = "newest" | "pickup-soonest";
type FilterOption = "all" | OrderStatus;

export default function SellerOrders() {
  const navigate = useNavigate();
  const { profile } = useSellerProfile();
  const { orders, loading, refetch } = useSellerOrders(profile?.id);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterOption>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "XCD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatOrderNumber = (num: number) => {
    return `#L${String(num).padStart(4, "0")}`;
  };

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

  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    let result = [...orders];

    // Filter by status
    if (statusFilter !== "all") {
      result = result.filter((order) => order.status === statusFilter);
    }

    // Search by customer name or order number
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (order) =>
          order.customer_name.toLowerCase().includes(query) ||
          formatOrderNumber(order.order_number).toLowerCase().includes(query)
      );
    }

    // Sort
    if (sortBy === "newest") {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === "pickup-soonest") {
      result.sort(
        (a, b) => new Date(a.preferred_date).getTime() - new Date(b.preferred_date).getTime()
      );
    }

    return result;
  }, [orders, statusFilter, searchQuery, sortBy]);

  // Calculate stats
  const stats = useMemo(() => {
    const completed = orders.filter((o) => o.status === "completed");
    const revenue = completed.reduce((sum, o) => sum + o.total_price, 0);
    const pending = orders.filter((o) => o.status === "pending" || o.status === "confirmed").length;
    const cancelled = orders.filter((o) => o.status === "cancelled").length;
    const noShow = orders.filter((o) => o.status === "no-show").length;

    return { revenue, completed: completed.length, pending, cancelled, noShow };
  }, [orders]);

  return (
    <SellerRouteGuard>
      <div className="flex min-h-screen flex-col bg-background">
        <SellerNav
          sellerName={profile?.seller_name}
          logoUrl={profile?.logo_url || undefined}
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

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <div className="rounded-lg border border-border/60 bg-card/50 p-3">
              <p className="text-xs text-muted-foreground">Revenue</p>
              <p className="text-lg font-bold text-green-400">{formatCurrency(stats.revenue)}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/50 p-3">
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="text-lg font-bold">{stats.completed}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/50 p-3">
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-lg font-bold text-yellow-400">{stats.pending}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/50 p-3">
              <p className="text-xs text-muted-foreground">Cancelled</p>
              <p className="text-lg font-bold text-red-400">{stats.cancelled}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/50 p-3">
              <p className="text-xs text-muted-foreground">No-Show</p>
              <p className="text-lg font-bold text-muted-foreground">{stats.noShow}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FilterOption)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {ORDER_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-40">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="pickup-soonest">Pickup Soonest</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Orders Table */}
          <div className="rounded-lg border border-border/60 bg-card/50">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">Order</TableHead>
                      <TableHead className="text-xs">Customer</TableHead>
                      <TableHead className="text-xs">Items</TableHead>
                      <TableHead className="text-xs">Total</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Pickup</TableHead>
                      <TableHead className="text-xs">Location</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow
                        key={order.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/seller/orders/${order.id}`)}
                      >
                        <TableCell className="py-3 font-mono text-xs">
                          {formatOrderNumber(order.order_number)}
                        </TableCell>
                        <TableCell className="py-3">
                          <div>
                            <p className="font-medium text-sm line-clamp-1">{order.customer_name}</p>
                            {order.customer_phone && (
                              <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            {order.items[0]?.product_image_url ? (
                              <img
                                src={order.items[0].product_image_url}
                                alt=""
                                className="h-8 w-8 rounded object-cover"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                                <Package className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <span className="text-sm">
                              {order.items.length === 1
                                ? order.items[0].product_name
                                : `${order.items.length} items`}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 font-medium text-green-400">
                          {formatCurrency(order.total_price)}
                        </TableCell>
                        <TableCell className="py-3">{getStatusBadge(order.status)}</TableCell>
                        <TableCell className="py-3 text-xs text-muted-foreground">
                          {formatDate(order.preferred_date)}
                        </TableCell>
                        <TableCell className="py-3 text-xs text-muted-foreground">
                          {order.location}
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/seller/orders/${order.id}`);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={(e) => messageCustomer(order.customer_phone, e)}
                              disabled={!order.customer_phone}
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/seller/orders/${order.id}`);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </main>
      </div>
    </SellerRouteGuard>
  );
}
