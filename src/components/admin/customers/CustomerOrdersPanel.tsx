import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ChevronRight } from "lucide-react";

interface Props {
  userId: string;
  email: string | null;
}

export function CustomerOrdersPanel({ userId, email }: Props) {
  const navigate = useNavigate();

  const { data: orders = [] } = useQuery({
    queryKey: ["admin-customer-orders", userId, email],
    queryFn: async () => {
      const orFilter = email
        ? `customer_user_id.eq.${userId},customer_email.eq.${email}`
        : `customer_user_id.eq.${userId}`;
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, total_price, currency_code, order_status, status, created_at")
        .or(orFilter)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No orders yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {orders.map((o) => (
        <button
          key={o.id}
          onClick={() => navigate(`/admin/orders/${o.id}`)}
          className="w-full flex items-center justify-between rounded-md border border-border bg-card p-3 hover:bg-accent/40 active:bg-accent/60 transition-colors text-left"
        >
          <div>
            <div className="font-medium text-sm">#L{String(o.order_number).padStart(4, "0")}</div>
            <div className="text-xs text-muted-foreground">{format(new Date(o.created_at), "MMM d, yyyy")}</div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-[10px] h-5">
              {o.order_status || o.status}
            </Badge>
            <div className="text-sm font-semibold">
              {o.currency_code} {Number(o.total_price).toFixed(2)}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </button>
      ))}
    </div>
  );
}
