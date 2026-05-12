## Goal
Change the top-left nav on the homepage only. Other pages keep the existing "Home | My Orders" layout.

## Homepage nav (route `/`)
- Remove the "Home" text link.
- Show "Orders" (renamed from "My Orders") as the first link on the far left, linking to `/my-orders`.
- If the logged-in user is an Admin, Seller, or Partner, show a second link "Dashboard" right after Orders.
  - Admin → `/admin` (priority if multiple roles)
  - Seller → `/seller`
  - Partner → `/partner`
- Logged-out users and plain customers see only "Orders".

## Non-homepage pages
- Keep current behavior unchanged: "Home | My Orders" with the existing badge.

## Technical changes
File: `src/components/Header.tsx`
- Detect homepage with `useLocation().pathname === "/"`.
- Reuse the existing `portalLink` state (already computes admin → `/admin`, approved seller → `/seller`). Extend it to also check `partner_profiles` and return `/partner` when the user only has a partner profile (admin still wins, seller next, then partner).
- Render two branches in the left cluster:
  - Homepage: `Orders` link (with existing active-order badge) + conditional `Dashboard` link when `portalLink` is set.
  - Other pages: existing `Home` + `My Orders` markup unchanged.
- Keep all styling, badge logic, and the right-side actions (User, DollarSign portal icon, Cart, mobile menu) untouched.

## Out of scope
- Mobile slide-out menu contents.
- Desktop main nav links (MegaNav, New Arrivals, etc.).
- Any routing or role logic outside the header.