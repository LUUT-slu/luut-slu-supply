

## Homepage Review Popup System

### Overview
Build a full review system: a popup form on the homepage for anyone to submit star-rated reviews with images, a display section for approved reviews, and admin management.

### Database

**New table: `reviews`**
- `id` uuid PK
- `reviewer_name` text (nullable, anonymous if empty)
- `rating` integer NOT NULL (1-5)
- `comment` text (max 200 chars, validated via trigger)
- `image_urls` text[] (max 2)
- `status` text DEFAULT 'pending' (pending/approved/rejected)
- `show_on_homepage` boolean DEFAULT false
- `created_at` timestamptz DEFAULT now()

**RLS policies:**
- Anyone can INSERT (public form, no login required)
- Anyone can SELECT where `status = 'approved'` and `show_on_homepage = true`
- Admins can do ALL

**Storage:** Use existing `seller-assets` public bucket with a `reviews/` prefix for uploaded images.

### New Components

1. **`src/components/ReviewPopup.tsx`** — Dialog triggered by a floating "Leave a Review" button on homepage
   - 5-star rating selector (tap-friendly, large touch targets)
   - Optional reviewer name field
   - Comment textarea with 200-char counter
   - Image upload (max 2, preview with remove)
   - Submit button with loading state and success toast
   - Uploads images to `seller-assets/reviews/` bucket

2. **`src/components/HomepageReviews.tsx`** — Section on homepage displaying approved reviews
   - Fetches reviews where `status = 'approved'` AND `show_on_homepage = true`
   - Shows star rating, comment, images, date, and reviewer name or "Anonymous"
   - Horizontal scroll or grid layout

3. **`src/pages/admin/AdminReviews.tsx`** — Admin review management page
   - Table of all reviews with status filter
   - Approve/reject/delete actions
   - Toggle homepage visibility
   - View uploaded images

### File Changes

- **`src/pages/Index.tsx`** — Add `<ReviewPopup />` floating button and `<HomepageReviews />` section before trust section
- **`src/App.tsx`** — Add `/admin/reviews` route
- **`src/pages/AdminHome.tsx`** — Add reviews link card to admin dashboard

### Validation
- Rating required (1-5)
- Comment max 200 chars (client + DB trigger)
- Max 2 images, image types only (client-side)
- Debounce/disable submit to prevent duplicates

