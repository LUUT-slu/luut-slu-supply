

## Customer Info — dedicated admin area

A new top-level admin section at **`/admin/customers`** with overview, profile detail, WhatsApp actions, signups, referrals, discounts, tags, and notes.

### Routes
- `/admin/customers` — overview list (search + filters)
- `/admin/customers/:userId` — full customer profile view with tabs

Add a **Customer Info** card to the Admin Hub (`AdminHome.tsx`) with `Users` icon, slotted near Manage Sellers / Order Management.

### Pages & components

**New files**
- `src/pages/admin/AdminCustomers.tsx` — overview list
- `src/pages/admin/AdminCustomerDetail.tsx` — single customer profile with tabs
- `src/components/admin/customers/CustomerTable.tsx` — sortable, mobile-friendly list (cards on mobile, table on desktop)
- `src/components/admin/customers/CustomerFilters.tsx` — search, signup status, tag, order count, discount, last contact filters
- `src/components/admin/customers/WhatsAppActions.tsx` — quick-action buttons opening pre-filled `wa.me` links (Welcome, Restock alert, Follow-up, Promo, Custom)
- `src/components/admin/customers/CustomerTagsEditor.tsx` — add/remove tags + product interest list
- `src/components/admin/customers/CustomerNotesPanel.tsx` — admin-only timestamped notes
- `src/components/admin/customers/CustomerDiscountsPanel.tsx` — view/grant/revoke discounts (uses `customer_discounts`)
- `src/components/admin/customers/CustomerReferralsPanel.tsx` — referral code, list of referred users, reward status, "Share via WhatsApp" CTA
- `src/components/admin/customers/CustomerOrdersPanel.tsx` — past orders with totals + link to order detail
- `src/components/admin/customers/SignupsTab.tsx` — recent signups (last 30 days), source if available, quick "Welcome via WhatsApp"
- `src/hooks/useAdminCustomers.ts` — data layer (list + detail + aggregates)

**Edited**
- `src/pages/AdminHome.tsx` — add the Customer Info card
- `src/App.tsx` — register the two new routes under `RouteGuard requiredRole="admin"`

### Database changes (new migration)

Three new tables to support tags, notes, referrals (none exist today).

```sql
-- Customer tags / interests (multi-row per customer)
create table public.customer_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tag text not null,
  tag_type text not null default 'tag', -- 'tag' | 'interest'
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (user_id, tag, tag_type)
);
alter table public.customer_tags enable row level security;
create policy "Admins manage customer tags" on public.customer_tags
  for all using (has_role(auth.uid(),'admin'::app_role))
  with check (has_role(auth.uid(),'admin'::app_role));

-- Admin-only customer notes
create table public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  note text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null
);
alter table public.customer_notes enable row level security;
create policy "Admins manage customer notes" on public.customer_notes
  for all using (has_role(auth.uid(),'admin'::app_role))
  with check (has_role(auth.uid(),'admin'::app_role));

-- Referrals
create table public.customer_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null,
  referral_code text not null unique,
  referred_user_id uuid,
  referred_email text,
  status text not null default 'pending', -- 'pending' | 'signed_up' | 'rewarded'
  reward_granted boolean not null default false,
  created_at timestamptz not null default now(),
  rewarded_at timestamptz
);
alter table public.customer_referrals enable row level security;
create policy "Admins manage referrals" on public.customer_referrals
  for all using (has_role(auth.uid(),'admin'::app_role))
  with check (has_role(auth.uid(),'admin'::app_role));
create policy "Users view own referrals" on public.customer_referrals
  for select using (auth.uid() = referrer_user_id);

-- Track last admin contact + signup source on customer_profiles
alter table public.customer_profiles
  add column if not exists last_contacted_at timestamptz,
  add column if not exists signup_source text;
```

### Customer Overview list (`/admin/customers`)

Columns (desktop) / stacked card (mobile):
- Name · Phone · Email · Signup status · Date added · Last activity (latest order or contact) · Total orders · Total spent

Data sources combined per row:
- `customer_profiles` (base record)
- `orders` aggregate: count + sum `total_price` grouped by `customer_user_id` (and email fallback)
- `customer_tags` for tag chips

Filters bar:
- Search (name / phone / email)
- Has account / Guest only
- Tag pills (multi-select)
- Order count: 0 / 1+ / 5+
- Has active discount
- Last contacted: never / >30d / <7d
- Product interest

### Customer Profile (`/admin/customers/:userId`)

Header: avatar initial, name, phone, email, account status badge, signup date, last activity, **WhatsApp** + **Email** quick chips.

Tabs:
1. **Overview** — summary cards (orders, spend, last order, active discount count) + tag chips
2. **Orders** — `CustomerOrdersPanel`
3. **WhatsApp** — `WhatsAppActions` (Welcome, Restock alert with product picker, Follow-up, Promo, Custom). Each writes a row to `customer_notes` ("Sent restock alert for X") and updates `last_contacted_at`.
4. **Referrals** — code, referred users, reward status, "Share code via WhatsApp"
5. **Discounts** — list active rows from `customer_discounts`, grant new (form: type, amount, currency)
6. **Tags & Interests** — editor
7. **Notes** — timestamped admin notes

### WhatsApp action templates

Open `https://wa.me/{phone}?text={encoded}` in new tab. Templates:
- Welcome — `Welcome to LUUT, {name}! Reply with any questions about your order.`
- Restock — `Hey {name}, the {product} you were interested in is back in stock!`
- Follow-up — `Hey {name}, following up on your last order. Everything good?`
- Promo — `{name}, here's an exclusive code for you: {code}`

### Mobile-friendly admin design

- Overview: card layout `<md`, table `≥md`
- Profile: tabs collapse to a horizontal scroll strip on mobile
- All action buttons ≥44px tap target

### Out of scope (kept for later)
- Automated campaign messaging / scheduled sends
- WhatsApp Business API integration (current flow uses `wa.me` deep links)
- Public customer-facing referral signup flow (admin can manually create codes; redemption logic comes later)

### Verification
- `/admin` shows Customer Info card → opens overview
- Search/filter work across name, phone, email, tags
- Click row → profile loads with all tabs populated from real data
- WhatsApp button opens correct chat with pre-filled text
- Adding tag/note/referral/discount persists and reflects in overview
- Mobile (390px): list and profile both usable, no horizontal scroll

