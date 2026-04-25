
# Fix: Sellers stuck in loading loop on first product creation

## Root causes found

1. **`useSellerProfile` never exposes a `loading` flag** to consumers. `SellerProductForm` and `SellerProducts` destructure only `{ profile }`. On a non‑admin seller's first visit, `profile` is `null` for a few hundred ms while the hook fetches. The "Add Product" page renders immediately, but `profile?.id` is required by both image upload and the RLS-protected `INSERT`. Users who submit fast hit the "Seller profile not found" toast.

2. **Edit-product infinite spinner.** `SellerProductForm` line 46 sets `loadingProduct = isEditing`. The effect that flips it off (`fetchProduct`) only runs once `profile?.id` exists. For a seller whose `seller_profiles` row is missing or whose hook hasn't resolved yet, `loadingProduct` never turns false → the page sits on a spinner forever. This is the literal "infinite loading" the user is describing.

3. **Missing profile not repaired.** A user who is an approved seller (admin marked them approved in `seller_applications`) but doesn't yet have a row in `seller_profiles` is stuck — the form has no path to create one. `useSellerProfile` returns `profile = null` permanently and every submit fails the `profile?.id` guard.

4. **Storage upload errors are swallowed.** `uploadImages` uses `console.error` + `continue`, so an RLS / network failure on `seller-assets` produces an empty array and the product is inserted with `images: []` (or the user gets a vague error). The user sees a spinner, never a real reason.

5. **No safety timeout.** `handleSubmit` awaits storage and the insert with no upper bound; if Supabase hangs, the spinner runs indefinitely.

6. **Submit/Add Product buttons aren't gated** on profile readiness, so users can click before the profile is loaded.

RLS itself is correct: `seller_products` INSERT policy allows any seller whose `seller_profiles` row matches `auth.uid()` and is `is_approved = true`. The bucket policies for `seller-assets` allow any authenticated user to INSERT. No DB changes needed.

## Fix plan

### 1. `src/hooks/useSellerProfile.ts`
- Expose `loading` in the returned object (it already exists internally) and add an `error` flag.
- Add a `repairProfile()` helper that, if the user has an `approved` row in `seller_applications` but no `seller_profiles` row, inserts a minimal `seller_profiles` row (seller_name from application, `is_approved=true`, `seller_status='approved'`). Trigger this automatically once when the initial fetch returns `null` for an authenticated user.
- This makes the "first product" case work for sellers who were just approved but never had a profile row provisioned.

### 2. `src/pages/seller/SellerProductForm.tsx`
- Import `loading` from `useSellerProfile` as `profileLoading`.
- Gate the page render: while `profileLoading` is true, show the existing spinner. Only after profile resolves either show the form or a clear "Seller profile not available — please refresh or contact support" empty state with a Retry button.
- Fix the edit-mode spinner: if `profileLoading` is false and `profile?.id` is still missing, stop showing the spinner and show the error state instead. Set `loadingProduct=false` in that branch.
- In `handleSubmit`:
  - If `profileLoading`, just return (button will be disabled anyway).
  - Wrap `uploadImages` so each individual file failure throws a real error message (e.g. `Image upload failed: <message>`) instead of silently continuing — show toast and abort if zero images uploaded successfully when new images were attempted.
  - Add a `Promise.race` 30 s timeout around the upload+insert sequence. On timeout, throw "Upload took too long — please try again" so `finally` resets `loading`.
  - After the insert, if Supabase returns an RLS error, surface a friendly message: "Your seller account isn't approved yet — contact support."
- Disable the submit button while `profileLoading || loading`.

### 3. `src/pages/seller/SellerProducts.tsx`
- Import `loading` from `useSellerProfile` as `profileLoading`.
- Disable the "Add Product" button while `profileLoading || !profile?.id`, with a small helper tooltip / muted note.
- Skip the products `fetch` until profile is ready (already does, but stop showing the spinning loader once profile resolves with no id — show the same friendly empty state).

### 4. Verification
- New seller (no `seller_profiles` row, but approved application): visit `/seller/products/new` → `repairProfile` creates the row → form becomes usable → first product saves successfully.
- Existing approved seller: form loads with profile already cached → submit works on first try.
- Admin: unaffected; admin path through `SellerRouteGuard` still grants access and `useSellerProfile` returns whatever profile the admin has.
- Force a storage failure (e.g. invalid file): toast shows the real reason; button resets, no spinner stuck.
- Force an RLS denial (simulate `is_approved=false`): clear "not approved" toast appears.

## Files to change
- edit `src/hooks/useSellerProfile.ts` — expose `loading`, auto-repair missing profile.
- edit `src/pages/seller/SellerProductForm.tsx` — gate on `profileLoading`, fix edit-spinner, real upload errors, timeout, friendly RLS message, disabled submit.
- edit `src/pages/seller/SellerProducts.tsx` — gate "Add Product" button on profile readiness.

No database migrations, no edge function changes, no RLS changes.
