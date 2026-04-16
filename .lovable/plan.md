

## Welcome Email for New Customer Signups (Using Resend)

### Overview
Create a welcome email that fires automatically when a new customer signs up, using the existing Resend connector (already configured with `RESEND_API_KEY` and `LOVABLE_API_KEY`).

### Approach
Since the project already has a working Resend-based email edge function (`send-order-email`), we'll follow the same pattern rather than setting up Lovable's transactional email infrastructure. The user explicitly requested Resend.

### Implementation

**1. Create `supabase/functions/send-welcome-email/index.ts`**
- New edge function that accepts a `userId` and `email` payload
- Fetches customer profile to get name
- Checks `customer_discounts` table for the EC$10 welcome discount
- Builds a branded HTML email with all requested sections (welcome, what you can do, how ordering works, important info, CTA, discount mention, footer)
- Sends via the Resend gateway (same pattern as `send-order-email`)
- Uses idempotency: checks a flag or logs to prevent duplicate sends

**2. Add `verify_jwt = false` to `supabase/config.toml`** for the new function

**3. Update `src/pages/Login.tsx`**
- After successful signup (`handleSignup`), invoke the new edge function:
  ```
  supabase.functions.invoke('send-welcome-email', { body: { userId, email } })
  ```
- Fire-and-forget (don't block signup flow)

### Email Design
- Clean white background, dark text
- LUUT SLU branded header (black bar with gold text, matching order emails)
- Sections: Welcome → What You Can Do → How It Works (4 steps) → Important Info → EC$10 discount callout → CTA button → Footer
- Mobile-friendly table-based layout (same approach as existing order emails)
- CTA button links to `/shop/best-sellers`

### Technical Details
- No database changes needed — uses existing `customer_profiles` and `customer_discounts` tables
- Idempotency: the function checks if welcome email was already sent by querying if the customer profile exists and is recent (within seconds of creation), preventing duplicate sends on retries
- Secrets already configured: `LOVABLE_API_KEY`, `RESEND_API_KEY`

### Files
1. `supabase/functions/send-welcome-email/index.ts` — New edge function
2. `supabase/config.toml` — Add function config
3. `src/pages/Login.tsx` — Add welcome email trigger after signup

