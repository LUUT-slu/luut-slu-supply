## Scope

Three changes. Poster UI stays exactly as it is. Display UI is restructured on both desktop and mobile to mirror the Poster UI layout. No edits to poster, display, or video generation logic / edge functions.

---

## 1. Strip yellow/gold from Video + Display tabs (desktop)

File: `src/pages/admin/MarketingStudio.tsx` → `VideoStudioPanel` (~lines 1455–1647).

The yellow comes from shadcn `<Button variant="default">` (theme primary = amber) and `<Card>`. Replace with the studio's grey tokens:

- `<Card>/<CardHeader>/<CardContent>` → `<div className="rounded-lg border border-[#1c1c1c] bg-[#0c0c0c] p-5">` + plain headings.
- Motion style + duration pills: plain `<button>`, active = `border-[#e8e8e8] bg-[#e8e8e8] text-[#080808]`, inactive = `border-[#1c1c1c] bg-[#111] text-[#aaa] hover:border-[#3a3a3a]`.
- Primary buttons (Generate Product Video, Animate Poster, Download MP4): `bg-[#e8e8e8] text-[#080808] hover:bg-[#d8d8d8] font-bold`.
- Outline buttons (Upload Poster Image): `border border-[#1c1c1c] bg-[#111] text-[#e8e8e8] hover:bg-[#181818]`.

Display tab already uses grey tokens — only the restructure (item 2) applies.

---

## 2. Display UI mirrors Poster UI — desktop

File: `src/pages/admin/marketing-studio/DesktopChrome.tsx` — `activeTab === "display"` branch (currently lines 506–513).

Replace single-column `displaySlot` wrapper with the same 3-column shell the poster tab uses:

```text
300px sidebar | flex-1 canvas | 180px action strip
```

Reuse the poster shell's exact spacing, dividers, header/footer chrome, and component patterns. Only the controls inside the sidebar and right strip change to display-specific items.

Sidebar (300px) — same section layout as poster sidebar:

- Product card (same component pattern as poster).
- Style: Studio / Lifestyle / Minimal / **Human Model** (2-col grid same as poster styles).
- Aspect Ratio pills: 1:1, 4:5, 9:16, 3:4, 16:9, 4:3 (same pill style as poster Format).
- Text on image (same `SidebarField` pattern).
- Background settings — 5 chips: Solid color, Gradient, Studio backdrop, Lifestyle scene, Transparent/removed.
- Additional prompt notes (same textarea pattern as poster Extra instructions).
- Sticky bottom Generate Display Image button (same sticky chrome as poster Generate).

Canvas (flex-1) — same toolbar + preview shell as poster:

- Toolbar left: Regenerate, Edit. Right: Share, Download (same `ToolbarButton` components).
- Preview: `displayResultUrl` shown `object-contain` with same border/shadow treatment as poster image.
- Empty state: "Generate a display image to see it here" using same `<Sparkles>` icon block as poster.
- Same lightbox-on-click behavior using `PosterLightbox` (rename usage; component already generic).

Right action strip (180px) — same components as poster:

- Ready label + `style · aspect` + model name.
- Divider, primary Download (`#e8e8e8`/`#080808`).
- `ActionStripButton` rows: WhatsApp, Copy link, Save to library.
- Divider, Regenerate, Adjust prompt.
- Collapsible prompt details (same `<details>` pattern).

Wiring: extend `DesktopChrome` props to accept display state + handlers from `MarketingStudio.tsx`:

`displayStyle`, `setDisplayStyle`, `displayAspect`, `setDisplayAspect`, `displayTextOverlay`, `setDisplayTextOverlay`, `displayBackground`, `setDisplayBackground`, `displayCustomPrompt`, `setDisplayCustomPrompt`, `displayLoading`, `displayResultUrl`, `onGenerateDisplay`, `onClearDisplay`, plus the Human Model state (item 3).

Keep `displaySlot` prop as fallback so existing callers don't break.

---

## 3. Display UI mirrors Poster UI — mobile + Human Model option

File: `src/pages/admin/marketing-studio/MobileShell.tsx`.

Mirror the mobile Poster shell for Display mode: same topbar, same fixed preview thumbnail (9:16 swap for chosen aspect) with the same lightbox + action buttons, same scrollable controls block, same sticky bottom Generate button (label "Generate Display Image" when in Display mode).

Inside the scroll area, render display-specific controls using the same card/pill primitives as the poster controls:

- Product card.
- Style chips: Studio / Lifestyle / Minimal / **Human Model** (with person icon).
- Aspect Ratio pills.
- Text on image input.
- Background settings chips (5 options).
- Additional prompt notes textarea.

Human Model state (shared by desktop + mobile, lifted in `MarketingStudio.tsx`):

```ts
type DisplayStyle = "studio" | "lifestyle" | "minimal" | "human";
type ModelGender = "male" | "female" | "unspecified";
type SkinTone = "light" | "medium-light" | "medium" | "medium-dark" | "dark";

const [modelGender, setModelGender] = useState<ModelGender>("unspecified");
const [skinTone, setSkinTone] = useState<SkinTone>("medium");
```

When Human Model is selected, reveal two sub-rows beneath the Style selector on both desktop and mobile:

- Gender pills: Male / Female / Unspecified.
- Skin tone pills: Light / Medium-Light / Medium / Medium-Dark / Dark.

Active state matches the rest of the system: `border-[#e8e8e8] bg-[#181818] text-[#e8e8e8]`. Person icon = lucide `User` (lucide is the icon set in use; "ti-user" called out in the spec, but `User` is the available equivalent).

Prompt composition — client-side only, in `generateDisplayImage` before invoking the edge function. When `displayStyle === "human"`, prepend to `customPrompt`:

```text
A real human model wearing/holding/using the product. The model should have <skinTone> skin tone.<gender clause> The product must be clearly visible and accurately represented. Fashion editorial style photography, professional lighting, clean background.
```

`<gender clause>` = `" The model is male."` / `" The model is female."` / empty for unspecified.

Send `style: "lifestyle"` to the edge function in this case (closest supported value) and pass the rest via `customPrompt`. Product image continues to flow as `productImageUrl` reference. No edge function change required.

---

## Files touched

- `src/pages/admin/MarketingStudio.tsx` — new state (Human Model gender + skin tone, background); extend `generateDisplayImage` to compose extra prompt; pass new props into DesktopChrome and MobileShell; recolor VideoStudioPanel.
- `src/pages/admin/marketing-studio/DesktopChrome.tsx` — replace `activeTab === "display"` with 3-column shell matching poster, accept new display props.
- `src/pages/admin/marketing-studio/MobileShell.tsx` — Display mode reuses the poster mobile shell structure, adds Human Model controls.

Poster UI (desktop and mobile) is not touched. Video tab structure unchanged — only colors. No edge function or generation logic changes.
