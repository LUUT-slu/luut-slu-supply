## Summary
Change `/admin/marketing-studio` so it opens to a two-card mode selector (Images / Videos) instead of immediately showing the poster interface. Once a mode is picked, a compact pill toggle at the top lets users switch back. Only `MarketingStudio.tsx` is modified.

## What already exists
- `VideoStudioPanel` is declared inline at the bottom of the file and currently rendered as a `TabsContent value="video"` inside the existing `Tabs` block.
- The lucide import on line 30 has `Image as ImageIcon` but not `Video`.

## Changes to `src/pages/admin/MarketingStudio.tsx`

### 1. State
Add near the other `useState` declarations (around line 170–200):
```tsx
const [studioMode, setStudioMode] = useState<'select' | 'images' | 'videos'>('select');
```

### 2. Import
Add `Video` to the existing `lucide-react` import on line 30.

### 3. Mode Selector (shown when `studioMode === 'select'`)
Immediately after the existing page header block (`<div className="mb-5 ...">` at line 892), insert a conditional block:
- If `studioMode === 'select'`: render a centered, full-width section containing:
  - Label: "What do you want to create?" (`text-sm text-muted-foreground`, centered)
  - Two side-by-side responsive cards (stack on mobile, side-by-side on tablet+). Each uses the existing `Card` component with:
    - `cursor-pointer`, `p-8`, `hover:border-primary`
    - Icon in a rounded square with subtle tinted background:
      - Images: fuchsia tint (`bg-fuchsia-500/10`, `text-fuchsia-500`), `ImageIcon`, h-12 w-12
      - Videos: blue tint (`bg-blue-500/10`, `text-blue-400`), `Video`, h-12 w-12
    - Title: "Images" / "Videos" (`text-xl font-semibold mt-4`)
    - Description text (`text-sm text-muted-foreground mt-2`)
    - On click: `setStudioMode('images')` / `setStudioMode('videos')`
- After rendering the selector, return early so none of the existing poster/video interface renders.

### 4. Mode Switcher Strip (shown when `studioMode === 'images'` or `'videos'`)
Just below the page header (and above the Poster Type selector), render a compact horizontal pill group:
- Two buttons: `[ImageIcon] Images` and `[Video] Videos`
- Active pill uses the primary/gold style (`variant="default"`)
- Inactive uses `variant="outline"`
- Clicking switches mode via `setStudioMode(...)`
- Layout: left-aligned, `mb-4`, small rounded pill buttons

### 5. Images mode (`studioMode === 'images'`)
Render **exactly** the current JSX that renders by default. No changes to the poster type selector, product picker, image prep, format tabs, preview, controls, copy tab, export, hidden export node, or image editor modal.

### 6. Videos mode (`studioMode === 'videos'`)
Render the existing `VideoStudioPanel` as the entire page content, passing `selectedProduct` and `posterType`. Remove the `TabsTrigger` for Video and the `TabsContent value="video"` from inside the `Tabs` block — the video UI moves from being a tab to being the full videos-mode page.

The `Tabs` block and everything inside it (format tabs, copy tab, preview, controls, export node) should only render when `studioMode === 'images'`.

### 7. Edge cases
- The `exportRef` hidden node and `ImageEditorModal` should still mount when in videos mode because `VideoStudioPanel` does not need them, but they are harmless. However, to keep the DOM clean, they can be wrapped inside the images-mode conditional along with the rest of the poster interface.
- `tab` state and all poster-related state remain untouched.

## Confirmation criteria
1. `/admin/marketing-studio` opens to the two-card mode selector.
2. Clicking Images loads the existing full poster interface unchanged.
3. Clicking Videos loads the video generation panel (existing `VideoStudioPanel`).
4. The pill toggle appears at the top when either mode is active.
5. Only `MarketingStudio.tsx` is modified.