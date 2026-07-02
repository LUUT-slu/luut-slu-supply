import { ProductCardSkeleton } from "./ProductCardSkeleton";
import { cn } from "@/lib/utils";

interface ProductGridSkeletonProps {
  count?: number;
  className?: string;
}

export function ProductGridSkeleton({
  count = 8,
  className = "grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4",
}: ProductGridSkeletonProps) {
  return (
    <div className={cn(className)}>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
