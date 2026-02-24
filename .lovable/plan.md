
# Structured Seller Application System

## Overview

Replace the WhatsApp-based "Apply to Sell" flow with a popup form on the Sell on Luut page. Applications go to the `seller_applications` table and are reviewed in the Admin Centre's existing Seller Requests page.

---

## Database Migration

Add new columns to the `seller_applications` table for the additional form fields:

```sql
ALTER TABLE seller_applications
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS secondary_phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS tiktok_url text;
```

The existing columns already cover: `name` (Full Name), `whatsapp` (Phone Number), `location`, `categories`. The `name` column currently stores the applicant's name which maps to "Full Name". The `whatsapp` column maps to "Phone Number".

No RLS changes needed -- existing policies already allow authenticated users to insert their own applications and admins to view/update all.

---

## File Changes

### 1. `src/pages/SellOnLuut.tsx`

- Remove the `ChatButton` import used for the CTA
- Add a `Dialog` (modal) component that opens when "Apply to Sell" is clicked
- The modal contains a form with:
  - **Mandatory**: Full Name, Phone Number, Business Name, Location, Instagram Link
  - **Optional**: Facebook Link, Secondary Phone, Email, TikTok Link
- On submit: check auth (redirect to `/login?next=/sell` if not logged in), then insert into `seller_applications`
- On success: show toast, close modal
- Remove the WhatsApp prefilled message variable (`applyMessage`)
- Remove the floating `ChatButton` at the bottom (it's a WhatsApp redirect)

### 2. `src/pages/AdminSellerRequests.tsx`

- Update the `SellerApplication` interface to include the new fields (`business_name`, `instagram_url`, `facebook_url`, `secondary_phone`, `email`, `tiktok_url`)
- Update the details dialog to display all new fields
- Add a "Message on WhatsApp" button in the details dialog that opens `wa.me/{phone}` with a prefilled clarification message
- The existing Approve, Reject, and Ban actions remain unchanged

### 3. `src/pages/seller/SellerApply.tsx`

- Remove the WhatsApp notification (`window.open(wa.me/...)`) from the `handleSubmit` function -- applications now go through the admin panel only, no WhatsApp redirect

---

## What Already Works (No Changes Needed)

- **Admin route**: `/admin/approvals` already renders `AdminSellerRequests` with admin RouteGuard
- **Approval flow**: `handleApprove` in `AdminSellerRequests` already creates/updates `seller_profiles`, sets `is_approved: true` and `seller_status: "approved"`
- **Seller access gating**: `RouteGuard` with `requiredRole="seller"` already checks `seller_profiles.is_approved` before granting access
- **Rejection/Ban**: Already implemented in `AdminSellerRequests`
- **RLS policies**: `seller_applications` already has policies for user insert and admin CRUD

---

## Technical Details

| Component | Detail |
|-----------|--------|
| Form validation | All mandatory fields checked before submit; zod not needed since fields are simple strings with `required` attribute |
| Auth check | `supabase.auth.getSession()` before insert; redirect to login if unauthenticated |
| Duplicate check | Query `seller_applications` for existing application by `user_id` before allowing resubmission |
| Modal component | Uses existing `Dialog` from `@radix-ui/react-dialog` (already installed) |
| Admin WhatsApp button | Normalizes phone number and opens `wa.me/` link with prefilled "Regarding your seller application on Luut..." message |
