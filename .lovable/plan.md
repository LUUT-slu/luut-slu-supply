
## Linking "Luut SLU Hub" Shopify Products to the LUUT SLU Admin Account

### Problem
All 21 Shopify products have their vendor set to **"Luut SLU Hub"** in Shopify, but the platform's admin seller account is named **"Luut SLU"**. This causes:
- Product cards showing "Sold by: Luut SLU Hub" instead of "Sold by: Luut SLU"
- Seller profile links going to `/seller/luut-slu-hub` (broken) instead of the correct seller page
- The "FROM LUUT SLU" homepage section potentially not matching products correctly

### Solution
Add a vendor name normalization function that maps "Luut SLU Hub" to "Luut SLU" across the codebase. This is a display-layer change -- no database or Shopify changes needed.

### Changes

**1. `src/lib/shopify.ts`** -- Add a vendor normalization helper
- Create a `normalizeVendorName()` function that maps known vendor aliases (like "Luut SLU Hub") to the canonical seller name ("Luut SLU")
- This keeps the mapping centralized and easy to update

**2. `src/lib/products.ts`** -- Normalize vendor in `shopifyToUnified()`
- Apply `normalizeVendorName()` when converting Shopify products to the unified format, so all downstream consumers (hybrid grid, product cards) get the correct name

**3. `src/components/ProductCard.tsx`** -- Normalize vendor for Shopify-only card
- Apply `normalizeVendorName()` to the vendor display and seller link generation

**4. `src/components/WhatPeopleAreBuyingSection.tsx`** -- Normalize vendor display
- Apply `normalizeVendorName()` to the "Sold by" line and seller link

**5. `src/pages/ProductDetail.tsx`** -- Normalize vendor on product detail page
- Apply `normalizeVendorName()` so the "Sold by" attribution and seller link point to the correct LUUT SLU seller page

### Technical Detail

The normalization function:

```text
function normalizeVendorName(vendor: string): string
  - If vendor contains "Luut SLU" (case-insensitive), return "Luut SLU"
  - Otherwise return vendor as-is
```

This means any Shopify vendor name like "Luut SLU Hub", "Luut SLU (Certified Seller)", or just "Luut SLU" all resolve to the same canonical name, ensuring consistent attribution to the admin seller account.

The sync function in `SellerProducts.tsx` already works correctly since `fetchProductsByVendor("Luut SLU")` uses `.includes()` matching, which catches "Luut SLU Hub".
