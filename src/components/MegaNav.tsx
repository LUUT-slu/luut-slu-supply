import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useTaxonomy } from '@/hooks/useTaxonomy';

/**
 * Desktop mega menu. Shows the marketplace top-level verticals (Clothing,
 * Electronics, Vehicles, …) sourced from Shopify collections — only those
 * with ≥1 product appear. Hovering opens a panel listing visible subs.
 */
export function MegaNav() {
  const { mains, loading } = useTaxonomy();
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  if (loading) {
    return (
      <Link
        to="/shop"
        className="font-body text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
      >
        Shop
      </Link>
    );
  }

  if (mains.length === 0) {
    return (
      <Link
        to="/shop"
        className="font-body text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
      >
        Shop
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-5" onMouseLeave={() => setOpenSlug(null)}>
      {mains.map((main) => {
        const open = openSlug === main.slug;
        return (
          <div key={main.slug} className="relative" onMouseEnter={() => setOpenSlug(main.slug)}>
            <Link
              to={main.url}
              className="flex items-center gap-1 font-body text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
              onFocus={() => setOpenSlug(main.slug)}
            >
              {main.title}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Link>
            {open && main.subs.length > 0 && (
              <div className="absolute left-0 top-full z-50 pt-3">
                <div className="grid w-[480px] grid-cols-2 gap-x-6 gap-y-2 rounded-md border border-border bg-background p-5 shadow-xl">
                  {main.subs.map((sub) => (
                    <Link
                      key={sub.handle}
                      to={sub.url}
                      className="flex items-center justify-between rounded px-2 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-muted hover:text-primary"
                      onClick={() => setOpenSlug(null)}
                    >
                      <span>{sub.title}</span>
                      <span className="text-xs text-muted-foreground">{sub.productCount}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
