## Bug fixes: NO_SHOW constraint + cancel-draft-order token

### Change 1 — New migration (supabase/migrations/)

Create one new migration file containing:

```sql
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_order_status_check
  CHECK (order_status IN ('NEW', 'ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'COMPLETED', 'CANCELLED', 'NO_SALE', 'NO_SHOW', 'DECLINED'));

CREATE OR REPLACE FUNCTION public.rpc_mark_no_sale(p_order_id uuid, p_note text DEFAULT NULL::text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
... existing body unchanged, including UPDATE writing 'NO_SHOW' ...
$function$;
```

The recreated `rpc_mark_no_sale` is byte-identical to the current version (it already writes `'NO_SHOW'`). The read-mapping CASE described in 1B is not in `rpc_mark_no_sale` itself — it lives in other partner-view queries; since scope-lock forbids touching other files, I will include the 'NO_SHOW' branch only if it actually appears inside `rpc_mark_no_sale` (it does not). The constraint change alone unblocks all writes, which the brief explicitly authorizes as the "minimum viable migration."

I'll search for any function/view containing the existing CASE to confirm whether 1B applies to a function I'm allowed to recreate inside this migration. If found in a DB function, I'll add the `NO_SHOW` branch in the same migration. If it lives only in frontend queries, it's out of scope.

### Change 2 — supabase/functions/cancel-draft-order/index.ts

Single-line replacement:

- FIND: `const shopifyAccessToken = Deno.env.get("SHOPIFY_ACCESS_TOKEN");`
- REPLACE: `const shopifyAccessToken = Deno.env.get("SHOPIFY_ADMIN_TOKEN");`

Nothing else in the file changes.

### Scope lock

- Modify: `supabase/functions/cancel-draft-order/index.ts` only.
- Create: one new migration file under `supabase/migrations/`.
- No frontend changes, no other edge function changes, no renames/reformats.

### Report back after build

1. Confirmation that the FIND string in `cancel-draft-order/index.ts` was located and replaced.
2. The new migration filename.
3. The exact SQL it contains.
