/**
 * Modular filter registry. Each main category can register a custom filter
 * panel; otherwise CommonFilters renders. Adding a vertical = add one
 * component + register it here.
 *
 * Filter values are derived client-side from already-loaded products
 * (no extra API calls). State lives in URL search params so links are
 * shareable and SEO-friendly.
 */

import type { UnifiedProduct } from '@/lib/products';
import { ClothingFilters } from './ClothingFilters';
import { ElectronicsFilters } from './ElectronicsFilters';
import { VehicleFilters } from './VehicleFilters';
import { CommonFilters } from './CommonFilters';

export type FilterValues = Record<string, string[]>;

export interface FilterPanelProps {
  products: UnifiedProduct[];
  values: FilterValues;
  onChange: (next: FilterValues) => void;
}

type PanelComponent = (props: FilterPanelProps) => JSX.Element;

const REGISTRY: Record<string, PanelComponent[]> = {
  clothing: [ClothingFilters, CommonFilters],
  electronics: [ElectronicsFilters, CommonFilters],
  vehicles: [VehicleFilters, CommonFilters],
};

export function getFiltersForMain(mainSlug: string | undefined): PanelComponent[] {
  if (!mainSlug) return [CommonFilters];
  return REGISTRY[mainSlug] ?? [CommonFilters];
}

/**
 * Apply current filter selections to a product list. The semantics:
 * - For each filter key, if the user selected one or more values, the
 *   product must match at least one (OR within key, AND across keys).
 * - "in_stock" key is special: when selected, exclude out-of-stock products.
 */
export function applyFilters(products: UnifiedProduct[], values: FilterValues): UnifiedProduct[] {
  const activeKeys = Object.keys(values).filter((k) => values[k]?.length);
  if (activeKeys.length === 0) return products;

  return products.filter((p) => {
    for (const key of activeKeys) {
      const wanted = values[key];
      if (key === 'in_stock') {
        if (p.stockStatus === 'out_of_stock') return false;
        continue;
      }
      // Variant option match
      const optionMatch = p.variants.some((v) =>
        v.selectedOptions.some(
          (o) =>
            o.name.toLowerCase() === key.toLowerCase() &&
            wanted.some((w) => w.toLowerCase() === o.value.toLowerCase()),
        ),
      );
      // Tag match (e.g. brand:nike)
      const tags = p.originalShopifyProduct?.node.tags ?? [];
      const tagMatch = tags.some((t) => {
        const [tagKey, tagVal] = t.split(':');
        if (!tagVal) return false;
        return (
          tagKey.toLowerCase() === key.toLowerCase() &&
          wanted.some((w) => w.toLowerCase() === tagVal.toLowerCase())
        );
      });
      if (!optionMatch && !tagMatch) return false;
    }
    return true;
  });
}

/** Read current selections from URL search params. */
export function readFiltersFromSearch(search: URLSearchParams): FilterValues {
  const out: FilterValues = {};
  for (const [key, value] of search.entries()) {
    if (key === 'sort' || key === 'page') continue;
    out[key] = value.split(',').filter(Boolean);
  }
  return out;
}

/** Serialize filter values back into URL search params (mutates in place). */
export function writeFiltersToSearch(values: FilterValues, search: URLSearchParams) {
  // Wipe existing filter keys (preserve sort/page)
  for (const key of Array.from(search.keys())) {
    if (key === 'sort' || key === 'page') continue;
    search.delete(key);
  }
  for (const [key, vals] of Object.entries(values)) {
    if (vals.length === 0) continue;
    search.set(key, vals.join(','));
  }
}
