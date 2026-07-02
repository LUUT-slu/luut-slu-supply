import { Skeleton } from "@/components/ui/skeleton";

interface TableRowSkeletonProps {
  columns?: number;
  rows?: number;
}

export function TableSkeleton({ columns = 5, rows = 6 }: TableRowSkeletonProps) {
  return (
    <div className="w-full overflow-hidden rounded-md border border-border">
      {/* Header */}
      <div
        className="grid gap-4 border-b border-border bg-muted/30 px-4 py-3"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-20" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid gap-4 border-b border-border/60 px-4 py-4 last:border-b-0"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className="h-4 w-full max-w-[160px]" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ListItemSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-md border border-border bg-card p-4">
          <Skeleton className="h-12 w-12 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      ))}
    </div>
  );
}
