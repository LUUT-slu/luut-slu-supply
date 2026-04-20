import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Phone, Mail, ShoppingBag, Tag } from "lucide-react";
import type { CustomerListItem } from "@/hooks/useAdminCustomers";

interface Props {
  customers: CustomerListItem[];
}

const formatMoney = (n: number) => `EC$${n.toFixed(2)}`;

export function CustomerTable({ customers }: Props) {
  const navigate = useNavigate();

  if (customers.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No customers match your filters.
      </div>
    );
  }

  return (
    <>
      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {customers.map((c) => (
          <button
            key={c.user_id}
            onClick={() => navigate(`/admin/customers/${c.user_id}`)}
            className="w-full text-left rounded-lg border border-border bg-card p-3 active:bg-accent/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{c.full_name || "Unnamed"}</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  {c.phone && (
                    <>
                      <Phone className="h-3 w-3" />
                      <span className="truncate">{c.phone}</span>
                    </>
                  )}
                </div>
                {c.email && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{c.email}</span>
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-muted-foreground">{c.total_orders} orders</div>
                <div className="text-sm font-semibold">{formatMoney(c.total_spent)}</div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1 min-w-0">
                {c.tags.slice(0, 3).map((t) => (
                  <Badge key={t} variant="secondary" className="text-[10px] h-5 px-1.5">
                    {t}
                  </Badge>
                ))}
                {c.has_active_discount && (
                  <Badge variant="default" className="text-[10px] h-5 px-1.5">
                    Discount
                  </Badge>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {formatDistanceToNow(new Date(c.last_order_at || c.created_at), { addSuffix: true })}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Customer</th>
              <th className="text-left px-3 py-2 font-medium">Contact</th>
              <th className="text-left px-3 py-2 font-medium">Tags</th>
              <th className="text-right px-3 py-2 font-medium">Orders</th>
              <th className="text-right px-3 py-2 font-medium">Spent</th>
              <th className="text-left px-3 py-2 font-medium">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr
                key={c.user_id}
                onClick={() => navigate(`/admin/customers/${c.user_id}`)}
                className="border-t border-border hover:bg-accent/40 cursor-pointer"
              >
                <td className="px-3 py-2.5">
                  <div className="font-medium">{c.full_name || "Unnamed"}</div>
                  <div className="text-xs text-muted-foreground">
                    Joined {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="text-xs">{c.phone || "—"}</div>
                  <div className="text-xs text-muted-foreground truncate max-w-[200px]">{c.email || "—"}</div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1 max-w-[180px]">
                    {c.tags.slice(0, 3).map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px] h-5 px-1.5">
                        {t}
                      </Badge>
                    ))}
                    {c.has_active_discount && (
                      <Badge variant="default" className="text-[10px] h-5 px-1.5">
                        Discount
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="inline-flex items-center gap-1">
                    <ShoppingBag className="h-3 w-3 text-muted-foreground" />
                    {c.total_orders}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-medium">{formatMoney(c.total_spent)}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(c.last_order_at || c.created_at), { addSuffix: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
