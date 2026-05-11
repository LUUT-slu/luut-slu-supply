import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, Navigate, Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ChatButton } from '@/components/ChatButton';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { UnifiedProductCard } from '@/components/UnifiedProductCard';
import { useTaxonomy } from '@/hooks/useTaxonomy';
import { useHybridProducts } from '@/hooks/useHybridProducts';
import {
  applyFilters,
  readFiltersFromSearch,
  writeFiltersToSearch,
  getFiltersForMain,
} from '@/components/filters/registry';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { SlidersHorizontal } from 'lucide-react';

type SortKey = 'newest' | 'price-asc' | 'price-desc' | 'best';

export default function CategorySub() {
  const { main: mainSlug, sub: subSlug } = useParams<{ main: string; sub: string }>();
  const { taxonomy, loading: taxLoading } = useTaxonomy();
  const [searchParams, setSearchParams] = useSearchParams();

  const filterValues = useMemo(() => readFiltersFromSearch(searchParams), [searchParams]);
  const sort = (searchParams.get('sort') as SortKey) || 'newest';

  const main = taxonomy?.mains.find((m) => m.slug === mainSlug);
  const sub = main?.subs.find((s) => s.slug === subSlug);

  const { products, loading } = useHybridProducts({
    categorySlug: sub?.handle,
    mainCategory: main?.title,
    subCategory: sub?.title,
    limit: 100,
  });

  // SEO
  useEffect(() => {
    if (!main || !sub) return;
    const title = `${sub.title} – ${main.title} | Luut SLU`;
    document.title = title.slice(0, 60);
    const desc = `Shop ${sub.title.toLowerCase()} in ${main.title.toLowerCase()} from local sellers in Saint Lucia.`;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', desc.slice(0, 160));
  }, [main, sub]);

  const filtered = useMemo(() => applyFilters(products, filterValues), [products, filterValues]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sort) {
      case 'price-asc':
        arr.sort((a, b) => parseFloat(a.price.amount) - parseFloat(b.price.amount));
        break;
      case 'price-desc':
        arr.sort((a, b) => parseFloat(b.price.amount) - parseFloat(a.price.amount));
        break;
      case 'best':
        // Keep API order (BEST_SELLING isn't requested explicitly here)
        break;
      case 'newest':
      default:
        // Already returned newest-first by Shopify default
        break;
    }
    return arr;
  }, [filtered, sort]);

  const Panels = useMemo(() => getFiltersForMain(mainSlug), [mainSlug]);

  // While taxonomy still loads, show spinner. After it loads, if either
  // segment is missing, redirect to /shop.
  if (taxLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!main || !sub) {
    return <Navigate to="/shop" replace />;
  }

  const handleFilterChange = (next: Record<string, string[]>) => {
    const params = new URLSearchParams(searchParams);
    writeFiltersToSearch(next, params);
    setSearchParams(params, { replace: true });
  };

  const handleSortChange = (val: SortKey) => {
    const params = new URLSearchParams(searchParams);
    params.set('sort', val);
    setSearchParams(params, { replace: true });
  };

  const FilterSidebar = (
    <aside className="space-y-6">
      <h3 className="font-display text-sm uppercase tracking-wider">Filter</h3>
      {Panels.map((Panel, i) => (
        <Panel key={i} products={products} values={filterValues} onChange={handleFilterChange} />
      ))}
    </aside>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        <section className="border-b border-border bg-card px-4 py-6 md:py-10">
          <div className="container">
            <Breadcrumbs
              items={[
                { label: 'Home', to: '/' },
                { label: main.title, to: main.url },
                { label: sub.title },
              ]}
            />
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl md:text-4xl">{sub.title}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {sorted.length} {sorted.length === 1 ? 'product' : 'products'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="lg:hidden">
                      <SlidersHorizontal className="mr-1.5 h-4 w-4" />
                      Filter
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-80 overflow-y-auto p-6">
                    {FilterSidebar}
                  </SheetContent>
                </Sheet>
                <Select value={sort} onValueChange={(v) => handleSortChange(v as SortKey)}>
                  <SelectTrigger className="h-9 w-[160px] text-sm">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="best">Best Selling</SelectItem>
                    <SelectItem value="price-asc">Price ↑</SelectItem>
                    <SelectItem value="price-desc">Price ↓</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-8">
          <div className="container">
            <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
              <div className="hidden lg:block">{FilterSidebar}</div>
              <div>
                {loading ? (
                  <div className="flex min-h-[300px] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : sorted.length === 0 ? (
                  <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
                    <p className="mb-2 font-body text-lg text-muted-foreground">No products match your filters</p>
                    <Link to={sub.url} className="text-sm text-primary hover:underline">
                      Clear filters
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 sm:gap-4">
                    {sorted.map((p, i) => (
                      <UnifiedProductCard key={p.id} product={p} priority={i < 4} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <ChatButton variant="floating" />
    </div>
  );
}
