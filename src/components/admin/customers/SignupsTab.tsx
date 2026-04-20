import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminCustomers } from "@/hooks/useAdminCustomers";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, ChevronRight } from "lucide-react";
import { subDays } from "date-fns";

export function SignupsTab() {
  const navigate = useNavigate();
  const { data: customers = [], isLoading } = useAdminCustomers();

  const recent = useMemo(() => {
    const cutoff = subDays(new Date(), 30);
    return customers
      .filter((c) => new Date(c.created_at) >= cutoff)
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }, [customers]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>;
  }

  if (recent.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No signups in the last 30 days.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground mb-2">{recent.length} signups in the last 30 days</div>
      {recent.map((c) => {
        const firstName = c.full_name?.split(" ")[0] || "there";
        const waMsg = `Welcome to LUUT, ${firstName}! Reply with any questions.`;
        const phone = c.phone?.replace(/[^\d+]/g, "").replace(/^\+/, "");
        return (
          <div
            key={c.user_id}
            className="flex items-center justify-between rounded-md border border-border bg-card p-3"
          >
            <button
              onClick={() => navigate(`/admin/customers/${c.user_id}`)}
              className="flex-1 min-w-0 text-left"
            >
              <div className="font-medium text-sm truncate">{c.full_name || "Unnamed"}</div>
              <div className="text-xs text-muted-foreground truncate">
                {c.email || c.phone || "No contact"} ·{" "}
                {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
              </div>
              {c.signup_source && (
                <Badge variant="outline" className="text-[10px] h-5 mt-1">
                  {c.signup_source}
                </Badge>
              )}
            </button>
            <div className="flex items-center gap-1 shrink-0">
              {phone && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 w-9 p-0"
                  onClick={() =>
                    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(waMsg)}`, "_blank")
                  }
                  title="Send welcome via WhatsApp"
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-9 w-9 p-0"
                onClick={() => navigate(`/admin/customers/${c.user_id}`)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
