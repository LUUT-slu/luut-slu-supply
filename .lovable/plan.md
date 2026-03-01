

## Shopify Connection Health Check + Sync Fixes

### Problem Diagnosis

**Immediate blocker**: The `manage-discounts` edge function fails with "Unauthorized" on every call. Root cause: `verifyAdmin()` creates a Supabase client with `SUPABASE_ANON_KEY` and the user's JWT, then calls `getUser()` — this pattern is fragile because it depends on the anon key matching the gateway's expectations. The `create-draft-order` function works because it uses `SUPABASE_SERVICE_ROLE_KEY` and bypasses auth entirely.

**Other issues**: Discount validation uses hardcoded price rule IDs; no diagnostic visibility for admins; no scope verification.

### Plan

#### Task 1: Fix `manage-discounts` auth (root cause of discount sync failure)

Change `verifyAdmin()` to use `SUPABASE_SERVICE_ROLE_KEY` (like `create-draft-order` does) instead of anon key with user JWT. Extract user ID from the JWT token directly to verify admin role. This matches the pattern already working in other edge functions.

#### Task 2: Fix `validate-discount` to use dynamic lookup

Remove the hardcoded `KNOWN_DISCOUNT_CODES` map. Instead, use Shopify's `discount_codes/lookup.json` endpoint to resolve any code dynamically, then fetch its price rule. This makes discount validation work for all codes (not just 1KPROMO).

#### Task 3: Create `shopify-health-check` edge function

New backend function that runs diagnostic tests against the Shopify Admin API:
- **Connection test**: Call `shop.json` to verify token validity
- **Scopes test**: Call `access_scopes.json` to get granted scopes
- **Products test**: Fetch 5 products
- **Discounts test**: Fetch price rules
- **Draft orders test**: Verify draft order access (read only)
- **Inventory test**: Fetch inventory levels

Returns structured results with pass/fail per test and specific error messages.

#### Task 4: Build Connection Health admin page

New page at `/admin/connection-health` with:

**A) Connection Status card**: Shop domain, API version, connected/disconnected status, last test timestamp.

**B) Required vs Granted Scopes checklist**: Static feature-to-scope mapping based on implemented features. Shows granted (green), missing (red), optional (blue) pills with explanations.

**C) Diagnostic test buttons**: Each test calls the health-check function and shows PASS/FAIL with error details. Tests: Products Read, Discounts Read, Discount Validate, Draft Order Read, Inventory Read, Metafields.

**D) Recent API logs panel**: Shows last results from diagnostic runs.

#### Task 5: Add Connection Health to Admin Hub

Add the health check page as a module card in AdminHub with a Shopify-themed icon. Route: `/admin/connection-health`. Admin-only access.

### Technical Details

**Auth fix in `manage-discounts`** (Task 1):
```typescript
// Replace anon key pattern with service role key
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
// Extract user ID from JWT in authorization header
const token = authHeader.replace("Bearer ", "");
const payload = JSON.parse(atob(token.split(".")[1]));
const userId = payload.sub;
// Then check user_roles with service role client
```

**Scope mapping** (Task 4):
```text
Feature                      → Required Scope        → Status
─────────────────────────────────────────────────────────────
Products listing             → read_products          → ✅/⚠️
Order creation (draft)       → write_draft_orders     → ✅/⚠️
Discount management          → read_price_rules       → ✅/⚠️
                             → write_price_rules      → ✅/⚠️
Inventory visibility         → read_inventory         → ✅/⚠️
Metafields (seller attr.)    → write_metafields       → ✅/⚠️
```

**What is NOT feasible in this environment**:
- OAuth reconnect flow (Shopify token is a stored secret, not managed via OAuth in Lovable Cloud)
- Instead, a "Reconnect" action will prompt you to update the stored token through the secrets management
- Real-time webhook sync (would need external infrastructure)

### Files to create/modify
- **Edit**: `supabase/functions/manage-discounts/index.ts` (fix auth)
- **Edit**: `supabase/functions/validate-discount/index.ts` (dynamic lookup)
- **Create**: `supabase/functions/shopify-health-check/index.ts`
- **Create**: `src/pages/admin/ConnectionHealth.tsx`
- **Edit**: `src/App.tsx` (add route)
- **Edit**: `src/pages/AdminHub.tsx` (add module card)
- **Edit**: `supabase/config.toml` (add health-check function)

