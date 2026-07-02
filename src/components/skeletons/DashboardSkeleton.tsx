import { Skeleton } from "@/components/ui/skeleton";
import { StatCardGridSkeleton } from "./StatCardSkeleton";
import { ListItemSkeleton } from "./TableSkeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <StatCardGridSkeleton count={4} />
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <ListItemSkeleton rows={5} />
      </div>
    </div>
  );
}

export function PageWithListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <ListItemSkeleton rows={rows} />
    </div>
  );
}
