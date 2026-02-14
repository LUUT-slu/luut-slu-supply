
# Fix: Sell Application Flow, Admin Review, and Header Navigation

## Problem Summary

1. The "Apply to Sell" button on `/sell` opens WhatsApp instead of the application form
2. The application form is missing required fields (first name, email, facebook link)
3. Instagram and WhatsApp should be mandatory
4. Admin hub needs to display the new application info and allow profile editing
5. Header needs a seller icon that goes to seller login

---

## Changes

### 1. Database Migration -- Add missing columns to `seller_profiles`

Add three new columns:
- `owner_first_name` (text, nullable)
- `owner_email` (text, nullable)
- `facebook_url` (text, nullable)

### 2. Fix "Apply to Sell" button (SellOnLuut.tsx)

Replace the `<ChatButton>` component (which opens WhatsApp) with a `<Link>` or `<Button>` that navigates to `/seller/apply`. The button keeps the same visual style.

### 3. Update Application Form (SellerApply.tsx)

Add new fields:
- **First Name** (required) -- stored as `owner_first_name`
- **Email** (required) -- stored as `owner_email`
- **Instagram Link** (required, was optional)
- **Facebook Link** (optional) -- stored as `facebook_url`
- **WhatsApp Number** (required, was optional)

Validation: form won't submit without first name, email, shop name, instagram, and whatsapp.

### 4. Update Admin Sellers Page (AdminSellersNew.tsx)

**Display changes:**
- Show owner first name and email in the pending applications table
- Show instagram, facebook, and description in an expandable detail view or detail dialog

**Edit capability:**
- Add an "Edit" button per seller that opens a dialog
- Dialog allows admin to edit: seller_name, shop_description, location, phone, whatsapp, instagram_url, facebook_url, categories
- Changes save directly to `seller_profiles`

### 5. Header Seller Icon (Header.tsx)

- Add a `Store` icon button in the header (between User and DollarSign icons) that links to `/login?next=/seller` so sellers can log in and get redirected to their portal
- On mobile menu, the existing "Sell on Luut" link already exists

---

## Files to Change

| File | Change |
|------|--------|
| Database migration | Add `owner_first_name`, `owner_email`, `facebook_url` columns |
| `src/pages/SellOnLuut.tsx` | Replace ChatButton with Link to `/seller/apply` |
| `src/pages/seller/SellerApply.tsx` | Add first name, email, facebook fields; make instagram + whatsapp required |
| `src/pages/AdminSellersNew.tsx` | Show new fields in table; add edit dialog for admin |
| `src/components/Header.tsx` | Add Store icon linking to seller login |
