

## Plan: Fix Draft Order Customer + Discount Slot Population

### Problem (from screenshot)
The Shopify draft order is missing two things:
1. **Customer slot is empty** — shows "Search or create a customer" despite name/phone being in the note
2. **Discount not applied in Payment section** — shows "Add discount" even though the code applied the `applied_discount` field

### Root Causes

**Customer**: Shopify's Draft Order API with just `first_name`/`last_name`/`phone` (no email, no existing customer ID) does not populate the Customer card. Shopify requires either a known `customer.id` or enough info to match an existing customer.

**Discount**: The `applied_discount` code at lines 304-341 looks correct, but if the discount lookup fails silently (e.g. redirect handling, 404), it falls through with no discount applied.

**Pickup time**: `pickupTime` is sent by checkout but never destructured or used in the edge function.

### Changes: `supabase/functions/create-draft-order/index.ts`

#### 1. Add `pickupTime` to interface and destructure it
Add `pickupTime?: string` to `DraftOrderRequest` and destructure it alongside other fields.

#### 2. Customer lookup by phone before draft order creation
Before building the draft order payload:
- Call `GET /admin/api/2025-01/customers/search.json?query=phone:{phone}`
- If a customer is found, use `{ id: existingCustomerId }` in the draft order
- If not found, call `POST /admin/api/2025-01/customers.json` to explicitly create the customer with `first_name`, `last_name`, `phone`, then use the returned `id`
- This ensures the Customer card in Shopify is always populated

#### 3. Add `shipping_address` to draft order payload
Even with a customer attached, add `shipping_address` so phone/name are visible on the order:
```
shipping_address: {
  first_name, last_name,
  phone: customerPhone,
  address1: "Pickup",
  city: location,
  country: "Saint Lucia",
  country_code: "LC"
}
```

#### 4. Add pickup time to note and metafields
- Update note format: `"📍 Pickup: {location} | 📅 Date: {date} | ⏰ Time: {pickupTime} | 📱 Phone: {phone}"`
- Add `metafields` array to draft order payload with namespace `pickup` for structured data (location, date, time, phone)

#### 5. Improve discount application reliability
- Add explicit logging when discount lookup fails at each step
- Handle the redirect scenario for `discount_codes/lookup.json` (Shopify returns 303 redirect — ensure `redirect: "manual"` is used and the redirect Location is followed correctly)
- If the discount is the internal WELCOME5 (fixed_amount), apply it directly without Shopify lookup since it's a local-only discount

#### 6. Phone normalization helper
Add a function to normalize phone to E.164 format for Saint Lucia:
- 7 digits → `+1758XXXXXXX`
- 10 digits → `+1XXXXXXXXXX`
- Already has `+` → leave as-is

### Files Modified
| File | Change |
|------|--------|
| `supabase/functions/create-draft-order/index.ts` | Customer lookup/create, shipping_address, pickupTime in note/metafields, discount reliability, phone normalization |

### Technical Details

**Shopify Customer Search API**: `GET /admin/api/2025-01/customers/search.json?query=phone:+1758XXXXXXX` returns matching customers. The first match's `id` is used.

**Shopify Customer Create API**: `POST /admin/api/2025-01/customers.json` with `{ customer: { first_name, last_name, phone, tags: "luut-connect" } }`.

**Discount redirect fix**: Shopify's `discount_codes/lookup.json` returns a 303 redirect to the actual discount code resource. Current code uses `redirect: "follow"` which may lose auth headers on redirect. Fix: use `redirect: "manual"`, extract Location header, and make a second authenticated request.

**Metafields on Draft Orders**: Shopify Admin API 2025-01 supports `metafields` on draft order creation as an array of `{ namespace, key, value, type }` objects.

