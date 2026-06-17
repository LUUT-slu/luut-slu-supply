## Goal

Stop concatenating option labels. Build a single coherent scene description where every selected option modifies the same scene, with the product as the default primary subject.

## Scope

Only `src/lib/marketingRouting.ts` — specifically `buildDisplayPrompt` (main offender) and `buildPosterPrompt` (apply the same scene-first pattern to its visual layer). No UI changes, no edge function changes, no new options. Existing `DisplayControls` / `PosterControls` shapes stay the same.

## New prompt-construction model

Replace fragment concatenation with a `composeScene()` helper that runs in this order:

1. **Resolve primary subject** using the priority list:
   `product > product interaction > human model > environment > style modifiers`.
   Product is always primary unless `goal === "human_model"` AND `focus !== "detail" && focus !== "in_use"` — but even then the model is "demonstrating" the product, never the focal point.

2. **Resolve interaction mode** from `focus` + `goal`:
   - `focus === "in_use"` or `goal === "human_model"` → "a person actively wearing/holding/using the product, product remains the primary subject, no floating product, no product placed beside the person"
   - `focus === "detail"` / `goal === "product_closeup"` → "extreme close-up, product fills 60–80% of the frame, camera close enough to reveal materials and stitching, no wide angle"
   - `goal === "product_display"` → "product isolated as the main subject, no distractions, product occupies most of the frame"
   - `goal === "product_hero"` → "hero composition, dramatic framing, product centered as the focal point"
   - `goal === "lifestyle_product"` → "product shown in realistic everyday use, environment supports but does not compete with the product"
   - `goal === "packaging_showcase"` → "retail packshot, packaging fills the frame, label legible"

3. **Resolve style layer** from `style`:
   - `studio` → "professional commercial photography setup, controlled studio lighting, clean backdrop, product remains the focal point"
   - `lifestyle` → "realistic everyday environment, natural light, product remains the focal point"
   - `minimal` → "minimalist composition, generous negative space, product remains the focal point"
   - `human` → folds into the human-model interaction clause above (do not also emit a separate style sentence).

4. **Resolve realism layer** from `realism`:
   - `hyper` → "hyper-realistic photograph, natural lighting, real camera depth of field, real textures, real shadows, real materials, no CGI look, no floating objects, no exaggerated textures"
   - `premium` / `luxury` → existing premium/luxury phrasing but rewritten as one sentence.
   - `standard` → omitted.

5. **Background** only added if it does NOT conflict with style/interaction (e.g. skip `solid` when goal is `lifestyle_product` or `human_model`; skip `lifestyle` bg when style is `studio`).

6. **Assemble one paragraph** in this shape:

   ```
   <Realism qualifier> <camera/interaction clause> of <product title>[(category)].
   <Style/environment clause>. <Background clause if not conflicting>.
   <Brand snippet>. <Reference-preservation clause if hasReference>. <User notes>.
   Compose strictly in a <aspectRatio> aspect ratio frame.
   ```

   Example output for `goal=human_model, focus=in_use, realism=hyper, style=human`:
   "Hyper-realistic close-up photograph of a person actively wearing and interacting with <product>. The product occupies most of the frame and remains the primary focus; the model exists only to demonstrate real-world use. Natural lighting, real textures and shadows, no floating objects, no secondary focal points. PRESERVE the product exactly as shown in the reference image…"

7. **Sanity gate**: before returning, drop any clause that contradicts a higher-priority clause (e.g. if interaction = "product isolated" but style = lifestyle environment, suppress the lifestyle environment clause). Implemented as a small set of suppression rules keyed on `(goal, style, background, focus)`.

## Poster builder

Apply the same `composeScene()` to the visual portion of `buildPosterPrompt` (the part describing the product imagery on the poster). Text/headline/CTA/aspect-ratio blocks stay as-is. The poster's `style` (clean/luxury/bold/hype/modern/minimal) continues to drive layout/typography wording, not the product scene.

## Out of scope

- No new options in the UI.
- No changes to `routeForPoster` / `routeForDisplay` model selection.
- No edge-function changes.
- Existing constants (`ENHANCE_*`) get replaced by the new resolver helpers; preset shapes stay identical so saved presets keep working.

## Risks / notes

- Behavior change for every generation. The change is intentional but may shift outputs even for users not selecting human/in-use combos. Acceptable per the request.
- `PromptPreview` will simply show the new composed prompt — no component edit needed.
