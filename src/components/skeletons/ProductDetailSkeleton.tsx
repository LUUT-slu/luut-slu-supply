import { Skeleton } from "@/components/ui/skeleton";

export function ProductDetailSkeleton() {
  return (
    <div className="container px-4 py-6 md:py-10">
      <Skeleton className="mb-4 h-4 w-40" />
      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        {/* Gallery */}
        <div className="space-y-3">
          <Skeleton className="aspect-square w-full rounded-md" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-16 rounded-md" />
            ))}
          </div>
        </div>

        {/* Details */}
        <div className="space-y-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-28" />

          <div className="space-y-2 pt-2">
            <Skeleton className="h-4 w-20" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-16 rounded-md" />
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Skeleton className="h-4 w-16" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-12 rounded-md" />
              ))}
            </div>
          </div>

          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />

          <div className="space-y-2 pt-4">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      </div>
    </div>
  );
}
