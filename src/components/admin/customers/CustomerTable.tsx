import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { Phone, Mail, ShoppingBag } from "lucide-react";
import type { CustomerListItem } from "@/hooks/useAdminCustomers";

interface Props {
  customers: CustomerListItem[];
}

const formatMoney = (n: number) => `EC$${n.toFixed(2)}`;

function ProviderBadge({ provider }: { provider: string | null }) {
  if (!provider || provider === "email") {
    return (
      <Badge variant="outline" className="text-[10px] h-5 px-1.5">
        Email
      </Badge>
    );
  }
  const label = provider.charAt(0).toUpperCase() + provider.slice(1);
  return (
    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
      {label}
    </Badge>
  );
}

function CustomerAvatar({ name, avatarUrl }: { name: string | null; avatarUrl: string | null }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <Avatar className="h-9 w-9 shrink-0">
      {avatarUrl && <AvatarImage src={avatarUrl} alt={name || "customer"} />}
      <AvatarFallback className="text-xs">{initial}</AvatarFallback>
    </Avatar>
  );
}

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
        {customers.map((c) => {
          const interestTags = c.tags.filter((t) => t.endsWith(" interest"));
          const otherTags = c.tags.filter((t) => !t.endsWith(" interest"));
          return (
            <button
              key={c.user_id}
              onClick={() => navigate(`/admin/customers/${c.user_id}`)}
              className="w-full text-left rounded-lg border border-border bg-card p-3 active:bg-accent/50 transition-colors"
            >
              <div className="flex items-start gap-3 mb-2">
                <CustomerAvatar name={c.full_name} avatarUrl={c.avatar_url} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-sm truncate">{c.full_name || "Unnamed"}</span>
                    <ProviderBadge provider={c.auth_provider} />
                  </div>
                  {c.phone && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Phone className="h-3 w-3" />
                      <span className="truncate">{c.phone}</span>
                    </div>
                  )}
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
              {(interestTags.length > 0 || otherTags.length > 0 || c.has_active_discount) && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1 min-w-0">
                    {interestTags.slice(0, 2).map((t) => (
                      <Badge key={t} variant="default" className="text-[10px] h-5 px-1.5 bg-primary/10 text-primary border border-primary/20">
                        {t}
                      </Badge>
                    ))}
                    {otherTags.slice(0, 2).map((t) => (
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
              )}
            </button>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Customer</th>
              <th className="text-left px-3 py-2 font-medium">Contact</th>
              <th className="text-left px-3 py-2 font-medium">Login</th>
              <th className="text-left px-3 py-2 font-medium">Interests &amp; tags</th>
              <th className="text-right px-3 py-2 font-medium">Orders</th>
              <th className="text-right px-3 py-2 font-medium">Spent</th>
              <th className="text-left px-3 py-2 font-medium">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const interestTags = c.tags.filter((t) => t.endsWith(" interest"));
              const otherTags = c.tags.filter((t) => !t.endsWith(" interest"));
              return (
                <tr
                  key={c.user_id}
                  onClick={() => navigate(`/admin/customers/${c.user_id}`)}
                  className="border-t border-border hover:bg-accent/40 cursor-pointer"
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <CustomerAvatar name={c.full_name} avatarUrl={c.avatar_url} />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{c.full_name || "Unnamed"}</div>
                        <div className="text-xs text-muted-foreground">
                          Joined {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-xs">{c.phone || "—"}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">{c.email || "—"}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <ProviderBadge provider={c.auth_provider} />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1 max-w-[220px]">
                      {interestTags.slice(0, 3).map((t) => (
                        <Badge key={t} variant="default" className="text-[10px] h-5 px-1.5 bg-primary/10 text-primary border border-primary/20">
                          {t}
                        </Badge>
                      ))}
                      {otherTags.slice(0, 3).map((t) => (
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
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
