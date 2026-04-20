

## Manual Image Editor for Marketing Studio

A Canva-style crop/zoom editor with undo/redo and per-image persistence.

### UX flow
1. User taps any product image in the poster preview → modal opens
2. Image displayed inside fixed crop frame matching current format (9:16 / 1:1 / 4:5)
3. Drag to pan, pinch/scroll/slider to zoom
4. Toolbar: Undo · Redo · Reset · Save
5. Live mini-preview at bottom shows poster with edit applied
6. Save → modal closes → poster updates instantly

### Architecture

**New files**
- `src/components/marketing/ImageEditorModal.tsx` — the editor (drag, zoom, undo/redo, safe-area overlay)
- `src/hooks/useImageEditHistory.ts` — undo/redo stack (capped at 50 entries)
- `src/lib/imageCropState.ts` — types + helpers for crop state `{ scale, offsetX, offsetY }` (offsets in normalized 0-1 coords so they survive frame-size changes)

**Modified files**
- `src/pages/admin/MarketingStudio.tsx` — store `Map<imageUrl, CropState>`, pass into templates, open modal on image click
- `src/components/marketing/templates.tsx` — apply `transform: scale() translate()` to hero `<img>` based on crop state, mark editable images with `data-editable-hero`, attach onClick handler

### Crop state model
```ts
type CropState = {
  scale: number;        // 1.0 = fit, up to 4.0
  offsetX: number;      // -1 to 1 (normalized)
  offsetY: number;      // -1 to 1 (normalized)
};
```
Stored per `imageUrl` in `Map`. Survives variant switches and is keyed independently per image, so multi-product posters keep individual edits.

### Editor controls
- **Drag**: pointer events (works for mouse + touch). Bounds-clamped so image can't leave the frame.
- **Zoom**: 
  - Slider (0.5×–4×) always visible
  - Wheel zoom on desktop
  - Two-finger pinch on touch
- **Buttons**: Undo (←), Redo (→), Reset (↻), Cancel, Save
- **Keyboard**: Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z redo, Esc cancel

### Undo/redo
- Push new state on drag-end and zoom-end (debounced, not on every pixel)
- Stack capped at 50 steps
- Reset clears stack and returns to `{ scale: 1, offsetX: 0, offsetY: 0 }`

### Safe-area overlay
Dashed rectangles inside the crop frame marking:
- Top 20% (where badge/headline sits)
- Bottom 25% (where price + CTA sit)
Toggle button to hide.

### Live preview sync
The poster preview's hero `<img>` uses the same `transform: scale(s) translate(x%, y%)` as the editor. Updating the crop state in MarketingStudio re-renders the template instantly.

### Export integrity
The hybrid Canvas2D renderer in `handleExport` already draws hero images natively. Update its math to apply the same scale + translate transform when computing source rectangle (`sx, sy, sw, sh`) so the exported JPEG matches the preview exactly. No quality loss because we sample from the original full-resolution image.

### Multi-product support
Multi-tile templates already render multiple `<img>` elements; each gets its own click handler keyed by `imageUrl`. The crop state Map handles them transparently.

### Mobile optimizations
- `touch-action: none` on draggable surface
- Pointer events (unified mouse + touch)
- `requestAnimationFrame` throttling on drag updates
- No layout thrashing — only `transform` changes

### Out of scope (can be added later)
- Rotation
- Filters/brightness
- Cropping the image itself (we only reframe; original pixels untouched)

