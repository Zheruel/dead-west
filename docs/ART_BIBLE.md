# DEAD WEST — Art Bible

**Chosen direction: dark ink-cartoon / woodcut** (canonical reference: `art/style/style_c.png` — ALWAYS pass it as Image 1 style reference; alternates in `art/concepts/` were rejected).

## Look
- Thick confident black ink outlines (~3–4 % of character height), woodcut cross-hatching for shading, flat muted colour fills with slight grain. Macabre vintage wanted-poster / tarot-card feel with Binding-of-Isaac-style readability.
- Exaggerated proportions: humans have oversized heads (~40 % of body height), small bodies, chunky hands/boots. Enemies are cartoon-grotesque, never realistic gore-porn. Blood is dark red, stylised splats.
- Camera: top-down 3/4 "Isaac" view — we look slightly down; characters face the camera (front view), sprites can be flipped horizontally in code.
- Light from top-left. **No baked cast shadows, no ground plane, no background** in sprites (the game draws a soft ellipse shadow). Rim/ink outline separates sprites from any floor.
- Sprites must read at their display size against ALL floor backgrounds — that means strong dark outline + a distinguishing silhouette + high-contrast key colour. Check every sprite composited over `bg_f1_a`, `bg_f2_a`, `bg_f3_a` when those exist.
- Supernatural = sickly green glow (#8fc23f) or hellfire red glow; use sparingly as accent.

## Palette
ink black `#120c0a` · sepia `#6b4423` · dust ochre `#b8843f` · sand `#d9b071` · bone `#e8dcc0` · dried blood `#8a1c1c` · hell red `#d63a2a` · poncho red `#a02c24` · rust `#8a4b1f` · sickly green `#8fc23f` · dusk purple `#4a3358` · lantern amber `#f0a640` · cave black-brown `#1e1612`.
Floor mood: F1 hot ochre/sand daylight-dusk; F2 desaturated grey-brown wood with amber lantern light + purple dusk; F3 near-black cave with rust timbers and green ghost-light.

## Prompt boilerplate (paste into every generation prompt; adapt the Subject)
```
Input images: Image 1: STYLE REFERENCE (match its ink outline weight, cross-hatch shading, muted palette, big-head cartoon proportions exactly; do not copy its layout or characters unless told).
Style: dark ink-cartoon woodcut game art, thick black outlines, cross-hatch shading, flat muted colours with grain, macabre wanted-poster feel, Binding-of-Isaac-like readability. Top-down 3/4 game camera, subject facing the camera. Light from top-left.
Avoid: cast shadow, ground plane, background, text, watermark, logos, photorealism, thin outlines, gradients that blur the outline.
```
Character consistency: for multi-frame strips write "the SAME character repeated N times in a single horizontal row, evenly spaced with clear empty gaps between them, identical scale and identical ground line, nothing overlapping, nothing cropped".

## Post-processing (see tools/sprites.py)
Generate → `art/raw/<key>.png` (keep raw) → `tools/sprites.py` (blob-slice, single scale factor, register on centroid-x/bottom, downsample only) → `public/assets/sprites/<key>.png` + `<key>.meta.json`. Prompts stored as `art/prompts/<key>.txt`. Approved assets are never overwritten in place — write `<key>-v2.png`, swap when accepted.

## Review checklist (per asset)
1. View the raw and the processed preview. 2. Same character/proportions across all frames. 3. Animation reads (walk cycles have alternating leg/arm poses; idle bobs). 4. Correct frame count/order per ASSET_SPEC. 5. Not cropped, no stray fragments, edges clean on dark AND light. 6. Outline weight matches style ref. 7. Readable at display size (view at 1×).
