import { Badge } from "@/components/ui/badge";
import { POStatus, STATUS_LABELS } from "@/hooks/usePurchaseOrders";

const COLOR: Record<POStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  ordered: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  paid: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  in_transit: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  arrived: "bg-green-500/20 text-green-700 dark:text-green-300",
  partially_arrived: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  published: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  selling: "bg-primary/15 text-primary",
  completed: "bg-slate-500/15 text-foreground",
  cancelled: "bg-destructive/15 text-destructive",
};

export function POStatusBadge({ status }: { status: POStatus }) {
  return <Badge className={`${COLOR[status]} border-transparent font-medium`}>{STATUS_LABELS[status]}</Badge>;
}
