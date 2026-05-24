import { UnifiedProduct, StockStatus } from './products';

/**
 * Option names that qualify as "visual" options — we split cards by these.
 * Size-only products stay as a single card.
 */
const VISUAL_OPTION_NAMES = new Set([
  'color', 'colour', 'style', 'design', 'pattern',
  'variant', 'model', 'finish', 'material',
]);

const SIZE_OPTION_NAMES = new Set(['size', 'sizes']);

export interface VariantListingProduct extends UnifiedProduct {
  /** When set, this card represents a specific visual option value */
  visualOptionName?: string;
  visualOptionValue?: string;
  /** The variant ID to pre-select on the product page */
  preselectedVariantId?: string;
  /** Original (unsplit) product id — used for promo/discount matching. */
  originalProductId: string;
}

/**
 * Determines if a product should be split by visual options.
 * Returns the visual option name if found, null otherwise.
 */
function getVisualOptionName(product: UnifiedProduct): string | null {
  if (product.source !== 'shopify' || !product.originalShopifyProduct) return null;

  const options = product.originalShopifyProduct.node.options;
  if (!options || options.length === 0) return null;

  for (const opt of options) {
    if (VISUAL_OPTION_NAMES.has(opt.name.toLowerCase()) && opt.values.length > 1) {
      return opt.name;
    }
  }
  return null;
}

/**
 * Splits products with visual options into separate listing entries.
 * Products with only size options stay as a single card.
 */
export function splitByVisualOptions(
  products: UnifiedProduct[],
  showOnlyInStock: boolean = true
): VariantListingProduct[] {
  const result: VariantListingProduct[] = [];

  for (const product of products) {
    const visualOptionName = getVisualOptionName(product);

    if (!visualOptionName) {
      // No visual option — keep as single card
      result.push({ ...product, originalProductId: product.id });
      continue;
    }

    const shopifyNode = product.originalShopifyProduct!.node;
    const visualOption = shopifyNode.options.find(
      o => o.name.toLowerCase() === visualOptionName.toLowerCase()
    );
    if (!visualOption) {
      result.push({ ...product, originalProductId: product.id });
      continue;
    }

    // Group variants by the visual option value
    for (const optionValue of visualOption.values) {
      const matchingVariants = product.variants.filter(v =>
        v.selectedOptions.some(
          o => o.name.toLowerCase() === visualOptionName.toLowerCase() && o.value === optionValue
        )
      );

      if (matchingVariants.length === 0) continue;

      // Aggregate stock status across sizes for this color
      const anyAvailable = matchingVariants.some(v => v.availableForSale);
      const totalAvailableCount = matchingVariants.filter(v => v.availableForSale).length;

      let stockStatus: StockStatus;
      if (!anyAvailable) {
        stockStatus = 'out_of_stock';
      } else if (totalAvailableCount <= 2) {
        // Treat as low stock if very few size variants available
        stockStatus = 'low_stock';
      } else {
        stockStatus = 'in_stock';
      }

      // Skip out-of-stock if setting says so
      if (showOnlyInStock && stockStatus === 'out_of_stock') continue;

      // Find the best image for this color: use the first variant that has an image
      const variantWithImage = matchingVariants.find(v => v.image?.url);
      const cardImage = variantWithImage?.image
        ? { url: variantWithImage.image.url, altText: variantWithImage.image.altText }
        : product.images[0]; // fallback to product image

      // Use the lowest price among matching variants
      const lowestPrice = matchingVariants.reduce((min, v) => {
        const p = parseFloat(v.price.amount);
        return p < min ? p : min;
      }, Infinity);

      // Pick the first available variant as the preselected one
      const preselectedVariant = matchingVariants.find(v => v.availableForSale) || matchingVariants[0];

      const listing: VariantListingProduct = {
        ...product,
        // Override with variant-specific data
        id: `${product.id}__${optionValue.replace(/\s+/g, '-').toLowerCase()}`,
        stockStatus,
        price: {
          amount: lowestPrice.toString(),
          currencyCode: product.price.currencyCode,
        },
        images: cardImage ? [cardImage] : product.images,
        variants: matchingVariants,
        visualOptionName,
        visualOptionValue: optionValue,
        preselectedVariantId: preselectedVariant?.id,
      };

      result.push(listing);
    }
  }

  return result;
}
