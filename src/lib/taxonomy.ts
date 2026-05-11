/**
 * Marketplace Taxonomy
 *
 * Multi-level category structure derived dynamically from Shopify collections
 * + local seller_products. No hardcoded categories required to ship a new
 * vertical — sellers create collections in Shopify with the convention below
 * and the website updates automatically.
 *
 * Convention
 * ----------
 *   - Level 1 (Main category) = collection handle prefixed with `main-`
 *       e.g. `main-clothing`, `main-electronics`, `main-vehicles`
 *   - Level 2 (Subcategory)   = collection handle in the form `<main>--<sub>`
 *       e.g. `clothing--beanies`, `electronics--phones`
 *
 * Subcategories whose `<main>` segment matches an existing main collection
 * become children of that main. Subcategories without a known parent are
 * grouped under a synthetic "Other" main.
 *
 * Visibility: a subcategory is visible only if it has products; a main is
 * visible only if at least one of its subcategories is visible.
 *
 * Priority order: Clothing first, then Streetwear / Sneakers / Accessories,
 * then everything else alphabetically. Tunable via `PRIORITY_ORDER`.
 */

import { storefrontApiRequest } from './shopify';
import { supabase } from '@/integrations/supabase/client';

const MAIN_PREFIX = 'main-';
const SUB_SEPARATOR = '--';

const PRIORITY_ORDER = ['clothing', 'streetwear', 'sneakers', 'shoes', 'accessories'];

export interface TaxonomySub {
  handle: string;          // full Shopify collection handle, e.g. "clothing--beanies"
  slug: string;            // sub portion, e.g. "beanies"
  title: string;
  description: string;
  image: string | null;
  productCount: number;    // Shopify products + matching local seller_products
  url: string;             // /c/<main>/<sub>
}

export interface TaxonomyMain {
  handle: string;          // "main-clothing"
  slug: string;            // "clothing"
  title: string;
  description: string;
  image: string | null;
  productCount: number;
  subs: TaxonomySub[];
  url: string;             // /c/<main>
}

export interface Taxonomy {
  mains: TaxonomyMain[];
}

interface RawCollection {
  id: string;
  handle: string;
  title: string;
  description: string;
  image: { url: string; altText: string | null } | null;
  productCount: number;
}

const TAXONOMY_QUERY = `
  query GetTaxonomyCollections($first: Int!) {
    collections(first: $first) {
      edges {
        node {
          id
          handle
          title
          description
          image { url altText }
          products(first: 1) { edges { node { id } } }
        }
      }
    }
  }
`;

const COLLECTION_COUNT_QUERY = `
  query GetCollectionCount($handle: String!) {
    collectionByHandle(handle: $handle) {
      products(first: 250) { edges { node { id } } }
    }
  }
`;

async function fetchAllCollections(): Promise<RawCollection[]> {
  const data = await storefrontApiRequest(TAXONOMY_QUERY, { first: 100 });
  if (!data?.data?.collections?.edges) return [];
  return data.data.collections.edges.map((edge: any) => ({
    id: edge.node.id,
    handle: edge.node.handle,
    title: edge.node.title,
    description: edge.node.description ?? '',
    image: edge.node.image ?? null,
    // Storefront API doesn't expose totalCount; we use products(first: 1)
    // as a "has any" probe and fetch a real count lazily for visible subs.
    productCount: edge.node.products?.edges?.length ?? 0,
  }));
}

async function fetchCollectionRealCount(handle: string): Promise<number> {
  const data = await storefrontApiRequest(COLLECTION_COUNT_QUERY, { handle });
  return data?.data?.collectionByHandle?.products?.edges?.length ?? 0;
}

interface LocalCount {
  main: string | null;
  sub: string | null;
  count: number;
}

async function fetchLocalCounts(): Promise<LocalCount[]> {
  const { data, error } = await supabase
    .from('seller_products')
    .select('main_category, sub_category')
    .eq('status', 'active')
    .is('shopify_product_id', null);

  if (error || !data) return [];

  const counts = new Map<string, LocalCount>();
  for (const row of data as Array<{ main_category: string | null; sub_category: string | null }>) {
    const key = `${row.main_category ?? ''}::${row.sub_category ?? ''}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { main: row.main_category, sub: row.sub_category, count: 1 });
    }
  }
  return Array.from(counts.values());
}

function slugify(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function priorityIndex(slug: string): number {
  const i = PRIORITY_ORDER.indexOf(slug);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

function sortByPriority<T extends { slug: string; title: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const pa = priorityIndex(a.slug);
    const pb = priorityIndex(b.slug);
    if (pa !== pb) return pa - pb;
    return a.title.localeCompare(b.title);
  });
}

export async function fetchTaxonomy(): Promise<Taxonomy> {
  const [collections, localCounts] = await Promise.all([
    fetchAllCollections(),
    fetchLocalCounts().catch(() => [] as LocalCount[]),
  ]);

  const mainsRaw = collections.filter((c) => c.handle.startsWith(MAIN_PREFIX));
  const subsRaw = collections.filter((c) => c.handle.includes(SUB_SEPARATOR) && !c.handle.startsWith(MAIN_PREFIX));

  // Build main lookup keyed by their slug ("clothing")
  const mainBySlug = new Map<string, TaxonomyMain>();

  for (const m of mainsRaw) {
    const slug = m.handle.slice(MAIN_PREFIX.length);
    mainBySlug.set(slug, {
      handle: m.handle,
      slug,
      title: m.title,
      description: m.description,
      image: m.image?.url ?? null,
      productCount: 0,
      subs: [],
      url: `/c/${slug}`,
    });
  }

  // Attach subs
  for (const s of subsRaw) {
    const [mainSlug, subSlug] = s.handle.split(SUB_SEPARATOR);
    if (!mainSlug || !subSlug) continue;

    let parent = mainBySlug.get(mainSlug);
    if (!parent) {
      // Synthetic main if a sub was created without its main. Use the
      // collection's title prefix as a friendly name.
      parent = {
        handle: `${MAIN_PREFIX}${mainSlug}`,
        slug: mainSlug,
        title: mainSlug.charAt(0).toUpperCase() + mainSlug.slice(1),
        description: '',
        image: null,
        productCount: 0,
        subs: [],
        url: `/c/${mainSlug}`,
      };
      mainBySlug.set(mainSlug, parent);
    }

    const sub: TaxonomySub = {
      handle: s.handle,
      slug: subSlug,
      title: s.title,
      description: s.description,
      image: s.image?.url ?? null,
      productCount: s.productCount,
      url: `/c/${parent.slug}/${subSlug}`,
    };

    // Add local product counts for this main+sub combination
    for (const lc of localCounts) {
      const matchesMain = lc.main && slugify(lc.main) === parent.slug;
      const matchesSub = lc.sub && slugify(lc.sub) === sub.slug;
      if (matchesMain && matchesSub) sub.productCount += lc.count;
    }

    parent.subs.push(sub);
  }

  // Filter out empty subs and empty mains
  const visibleMains: TaxonomyMain[] = [];
  for (const main of mainBySlug.values()) {
    const visibleSubs = main.subs.filter((s) => s.productCount > 0);
    if (visibleSubs.length === 0) continue;
    main.subs = sortByPriority(visibleSubs);
    main.productCount = visibleSubs.reduce((sum, s) => sum + s.productCount, 0);
    visibleMains.push(main);
  }

  return { mains: sortByPriority(visibleMains) };
}

export function findMain(taxonomy: Taxonomy | undefined, mainSlug: string): TaxonomyMain | undefined {
  return taxonomy?.mains.find((m) => m.slug === mainSlug);
}

export function findSub(
  taxonomy: Taxonomy | undefined,
  mainSlug: string,
  subSlug: string,
): { main: TaxonomyMain; sub: TaxonomySub } | undefined {
  const main = findMain(taxonomy, mainSlug);
  if (!main) return undefined;
  const sub = main.subs.find((s) => s.slug === subSlug);
  if (!sub) return undefined;
  return { main, sub };
}

/**
 * Resolve a legacy `/shop/:category` slug to a (main, sub) tuple in the new
 * taxonomy if possible. Returns null when no match exists; callers should
 * fall back to the legacy ShopCategory page.
 */
export function resolveLegacySlug(
  taxonomy: Taxonomy | undefined,
  legacySlug: string,
): { main: string; sub: string } | null {
  if (!taxonomy) return null;
  for (const main of taxonomy.mains) {
    for (const sub of main.subs) {
      if (sub.slug === legacySlug || sub.handle === legacySlug) {
        return { main: main.slug, sub: sub.slug };
      }
    }
  }
  return null;
}

export { fetchCollectionRealCount };
