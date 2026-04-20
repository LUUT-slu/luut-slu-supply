

## Improved Poster Export — Mobile + Desktop

Replace the simple `<a download>` flow with a device-aware export that uses the Web Share API (Level 2, with files) on mobile when available and falls back to a real file download elsewhere. Filenames become descriptive and format-aware.

### Behavior matrix

| Device | Capability | Action |
|---|---|---|
| Desktop (Chrome/Edge/Firefox/Safari) | — | Blob → `<a download>` → saves to Downloads folder |
| Mobile w/ `navigator.canShare({files})` (iOS Safari 15+, Android Chrome) | Share sheet | Opens native share → user taps "Save Image" / "Save to Photos" |
| Mobile without share-files support | — | Blob URL download fallback + toast hint "Tap and hold the image to save" |

Detection: `'share' in navigator && navigator.canShare?.({ files: [testFile] })` — only call share path when truly supported, otherwise fall back. Wrap in try/catch so a user cancelling share doesn't show error.

### Filename format

`luutslu-{posterType}-{slug}-{format}.png`

- Single product: `luutslu-product-{productSlug}-{format}.png` → `luutslu-product-blue-hoodie-story.png`
- Best Sellers: `luutslu-best-sellers-week-{yyyy-mm-dd}.png`
- New Arrivals / Restocked / Almost Gone / Promotions: `luutslu-{type}-{yyyy-mm-dd}-{format}.png`
- Promotion campaign selected: `luutslu-promo-{campaignSlug}-{format}.png`

Helper `buildPosterFilename(posterType, format, opts)` lives next to `handleExport`.

### Export pipeline (replace existing `handleExport`)

1. Render `exportRef` via `toPng` with `pixelRatio: 2` (sharper download — preview stays at 1) and `cacheBust: true`.
2. Convert data URL → `Blob` → `File` (`new File([blob], filename, {type:'image/png'})`).
3. **Try share path** if `navigator.canShare?.({ files: [file] })` and `isMobile` → `await navigator.share({ files: [file], title, text })`. On `AbortError` silently no-op. On other errors fall through.
4. **Fallback download** path: create blob URL → temp `<a>` → click → `URL.revokeObjectURL` after 1s.
5. iOS Safari quirk: when share unavailable, briefly show a sheet/toast "Press and hold the image below to save" and render a temporary preview image (download often fails to save to Photos directly on iOS without share).

### UI updates in MarketingStudio

- Rename button text: **Save / Share** on mobile (when share-files supported), **Download PNG** otherwise. Detect once at mount.
- Keep existing icon (Download) but swap to `Share2` icon when share path active.
- Disable + spinner unchanged.
- Toast messaging:
  - Desktop: "Saved to Downloads"
  - Mobile share: no toast (the OS sheet handles feedback)
  - Mobile fallback: "Image ready — tap and hold to save to Photos"

### Files

**Edited (1)**
- `src/pages/admin/MarketingStudio.tsx`
  - Add `buildPosterFilename()` helper
  - Add `canShareFiles()` detection helper
  - Rewrite `handleExport` with share-first then download fallback
  - Bump `pixelRatio` to 2 for export
  - Dynamic button label/icon based on capability

### Out of scope
- Native gallery write (browser sandbox prevents direct Photos API access — share sheet is the canonical mobile path)
- Capacitor / native plugin route (would require packaging as a native app)
- PDF / multi-format export
- Bulk export of multiple posters at once

### Result
- Desktop: tap **Download PNG** → file lands in Downloads folder named `luutslu-best-sellers-week-2026-04-20.png`
- Android Chrome / iOS Safari (modern): tap **Save / Share** → native share sheet opens → user picks "Save to Photos" / "Save Image"
- Older mobile browser: PNG downloads + clear instruction toast for saving to gallery
- Preview always matches export (same render node, just at 2× pixel ratio)

