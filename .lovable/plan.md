

## Remove "sold" Count from Best Sellers

Remove the quantity sold text from both Best Sellers displays while keeping the ranking badges and prices.

### Changes

**1. BestSellersSection component** (`src/components/BestSellersSection.tsx`)
- Remove line 79-81: the `<p>{product.total_sold} sold</p>` element

**2. BestSellers page** (`src/pages/BestSellers.tsx`)
- Remove line 70-72: the `<p>{item.total_sold} sold</p>` element

### Result
Best sellers will still show the #1, #2, #3 ranking badges and product prices, but no longer display how many units were sold.

