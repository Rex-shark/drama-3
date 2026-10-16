---
version: alpha
name: REX LAB — Paper & Ink
description: Monochrome letterpress identity. Black ink pressed into thick, matte cotton card stock, lying on paper under a diagonal window shadow.
colors:
  primary: "#121212"
  paper: "#f1f1ef"
  card: "#fbfbf9"
  shade: "#c9c9c6"
  ink-muted: "#595957"
  line-soft: "#d2d2ce"
  edge-1: "#e4e4e0"
  edge-2: "#d3d3cf"
  primary-dark: "#ecebe8"
  paper-dark: "#161616"
  card-dark: "#202020"
  shade-dark: "#0b0b0b"
  ink-muted-dark: "#a2a19d"
  line-soft-dark: "#30302e"
  edge-1-dark: "#2a2a29"
  edge-2-dark: "#0e0e0e"
typography:
  display-xl:
    fontFamily: Lexend
    fontSize: 168px
    fontWeight: 500
    lineHeight: 0.88
    letterSpacing: -0.015em
  heading:
    fontFamily: Lexend
    fontSize: 30px
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: -0.005em
  lead:
    fontFamily: Lexend
    fontSize: 26px
    fontWeight: 300
    lineHeight: 1.35
  label:
    fontFamily: Lexend
    fontSize: 12px
    fontWeight: 500
    lineHeight: 16px
    letterSpacing: 0.16em
  body:
    fontFamily: Noto Sans TC
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.75
  sub-cjk:
    fontFamily: Noto Sans TC
    fontSize: 13px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: 0.18em
  meta:
    fontFamily: IBM Plex Mono
    fontSize: 11px
    fontWeight: 400
    lineHeight: 16px
    letterSpacing: 0.06em
rounded:
  none: 0px
  xs: 1px
spacing:
  "1": 4px
  "2": 8px
  "4": 16px
  "6": 24px
  "12": 48px
  "14": 56px
  "24": 96px
components:
  page:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.primary}"
    typography: "{typography.body}"
  page-dark:
    backgroundColor: "{colors.paper-dark}"
    textColor: "{colors.primary-dark}"
  sheet:
    backgroundColor: "{colors.card}"
    textColor: "{colors.primary}"
    typography: "{typography.display-xl}"
    rounded: "{rounded.xs}"
    padding: 56px
  sheet-dark:
    backgroundColor: "{colors.card-dark}"
    textColor: "{colors.primary-dark}"
    rounded: "{rounded.xs}"
  sheet-edge:
    backgroundColor: "{colors.edge-1}"
    height: 1.5px
  sheet-edge-under:
    backgroundColor: "{colors.edge-2}"
    height: 3px
  sheet-edge-dark:
    backgroundColor: "{colors.edge-1-dark}"
    height: 1.5px
  sheet-edge-under-dark:
    backgroundColor: "{colors.edge-2-dark}"
    height: 3px
  sheet-caption:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.sub-cjk}"
  sheet-caption-dark:
    backgroundColor: "{colors.card-dark}"
    textColor: "{colors.ink-muted-dark}"
  window-shadow:
    backgroundColor: "{colors.shade}"
  window-shadow-dark:
    backgroundColor: "{colors.shade-dark}"
  hairline:
    backgroundColor: "{colors.primary}"
    height: 1px
  row-divider:
    backgroundColor: "{colors.line-soft}"
    height: 1px
  row-divider-dark:
    backgroundColor: "{colors.line-soft-dark}"
    height: 1px
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: 8px 14px
  button-outline-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.card}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: 8px 14px
---

# REX LAB — Paper & Ink

## Overview

The whole interface is a physical object photographed in daylight: a sheet of thick, matte, uncoated card stock with black letterpress type, lying on a slightly greyer paper surface, crossed by the hard-edged shadow of a window frame. There is no accent colour. Depth, warmth and personality come entirely from three material effects: **paper tooth**, **letterpress impression** and **cast light**.

Every effect is generated in the browser (SVG filters as `data:` URIs plus CSS). No bitmap textures. Effects must stay subtle enough that, at a glance, the page reads as flat black-on-white; the material is discovered on a second look.

## Colors

- **Primary (#121212):** letterpress ink. All type, the hairline, arrows. Never pure #000, so it can sit in the paper rather than on it.
- **Paper (#f1f1ef):** the ground. Cool, faintly grey, so the card can be lighter than it.
- **Card (#fbfbf9):** the card stock. Always lighter than paper; the difference (≈3% L) is what separates sheet from ground before any shadow is added.
- **Shade (#c9c9c6):** colour of the window shadow. Used only through `multiply` at 55–60% opacity, never as a flat fill behind text.
- **Ink-muted (#595957):** captions, CJK sub-lines, body copy on paper. ≥4.5:1 on both paper and card.
- **Line-soft (#d2d2ce):** dividers between list rows when a full ink hairline would be too loud.
- **Edge-1 / Edge-2 (#e4e4e0 / #d3d3cf):** the visible thickness of the card stock (see Elevation).

Dark theme is "black card on black paper": `*-dark` tokens. Paper and card swap to charcoal, ink turns to off-white, the window shadow becomes deeper black, and every texture switches blend mode from `multiply` to `overlay` (see Elevation & Depth → Paper texture).

## Typography

- **Lexend 500** for the name and headings, uppercase for the wordmark, tight tracking (−0.015em). Two-line stacked name (`REX` / `LAB`), line-height 0.88.
- **Lexend 300** for lead sentences: light, large, quiet.
- **Noto Sans TC** for all running text in Traditional Chinese; CJK sub-lines are small and widely tracked (0.18em), like a printed address line.
- **IBM Plex Mono** only for meta (years, places, "1 COLOR").
- Letterpress treatment (see Elevation) applies to the display name, the CJK sub-line and the arrow only. Never to body copy: it hurts legibility at small sizes.

## Layout

- One sheet per screen. The hero is a single card, max 880px wide, rotated −1.2° (−0.6° on phones) so it reads as an object placed by hand, not a UI box.
- Sheet anatomy: name zone on top (`padding: 56px`), one ink hairline, detail zone below (meta left, CJK sub-line right).
- Below the hero, the page is signage: `label` heading + full-width hairline, then rows divided by `line-soft`, each ending in a thin arrow.
- Spacing scale is 4 / 8 / 16 / 24 / 48 / 56 / 96. Gutter ≥16px.

## Elevation & Depth

Depth is the core of this system. There are exactly four layers, from back to front:

| Layer | What it simulates | Technique |
|---|---|---|
| 0. Paper ground | Uncoated paper surface | `paper` + tooth texture + cloud texture |
| 1. Window shadow | Light through a window frame | 118° hard-edged gradient in `shade`, `multiply` |
| 2. Card sheet | Thick cotton card | `card` + heavier tooth + stacked-edge shadow + soft drop |
| 3. Impression | Ink pressed into the card | 1px light lip under strokes + speckle mask |

### Paper texture (layer 0 and 2)

Paper is made of three stacked background layers blended with the base colour.

**1. Tooth**: fibre relief. Fractal noise lit by a distant light, then remapped close to white so `multiply` only darkens the pits and leaves the flat surface untouched:

```xml
<filter id="p" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="4" stitchTiles="stitch"/>
  <feDiffuseLighting lighting-color="#fff" surfaceScale="1.8">
    <feDistantLight azimuth="225" elevation="55"/>
  </feDiffuseLighting>
  <feComponentTransfer>  <!-- remap: flat ≈ .97, pits ≈ .80 -->
    <feFuncR type="linear" slope=".5" intercept=".57"/>
    <feFuncG type="linear" slope=".5" intercept=".57"/>
    <feFuncB type="linear" slope=".5" intercept=".57"/>
  </feComponentTransfer>
</filter>
```

| Parameter | Ground (paper) | Card stock | Effect |
|---|---|---|---|
| `baseFrequency` | .7 | .85 | Higher = finer fibre |
| `numOctaves` | 4 | 5 | Detail layers |
| `surfaceScale` | 1.8 | 1.5 | Depth of relief. Above ~2 it reads as stucco, not paper |
| `elevation` | 55° | 50° | Lower = longer micro-shadows |
| remap slope / intercept (light) | .5 / .57 | .4 / .63 | Keep flat surface ≥ .93 |
| remap slope / intercept (dark) | .35 / .21 | .35 / .23 | Centre on .5 so `overlay` is neutral |

Light azimuth is **225° (light from top-left)** everywhere. It must agree with the window shadow and the letterpress lip.

**2. Cloud**: pulp formation. Very low, anisotropic frequency, compressed to a ±6% band:

```xml
<feTurbulence type="fractalNoise" baseFrequency=".006 .018" numOctaves="3" stitchTiles="stitch"/>
<feColorMatrix values=".14 0 0 0 .88  .14 0 0 0 .88  .14 0 0 0 .88  0 0 0 0 1"/>
<!-- dark theme: offset .43 instead of .88 -->
```

**3. Sheen** (card only): `radial-gradient(120% 90% at 20% 0%, rgba(255,255,255,.5), transparent 60%)`, a soft highlight where the window light lands.

Composition:

```css
body   { background-color: var(--paper);
         background-image: var(--tex-tooth), var(--tex-cloud);
         background-blend-mode: var(--tex-blend); }      /* multiply | overlay(dark) */
.sheet { background-color: var(--card);
         background-image: var(--tex-sheet), <sheen>, var(--tex-cloud);
         background-blend-mode: var(--tex-blend); }
```

Tile sizes: tooth 240px, card tooth 260px, cloud 640px. Use different tile sizes so repeats never line up.

### Window shadow (layer 1)

A diagonal, hard-edged shadow cast by a window frame across the hero, light coming from the top-left:

```css
.hero::before, .hero::after {
  background: linear-gradient(118deg, transparent 0 51.6%, var(--shade) 53% 100%);
  mask-image: linear-gradient(180deg, transparent, #000 22%, #000 70%, transparent);
}
.hero::before { z-index: -1; opacity: .6; }                          /* on the ground, under the card */
.hero::after  { z-index: 2; opacity: .55; mix-blend-mode: multiply;   /* across the card, over the ink */
                pointer-events: none; }
```

- **Angle 118°**: a steep diagonal, not 45°. Steeper reads as late-afternoon light.
- **Penumbra 1.4%** (51.6% → 53%): a crisp but not vector-sharp edge. 0% looks drawn; >3% looks like a gradient.
- **Two passes**: one under the card (falls on the ground) and one over it (falls on the card). The card must be *inside* the shadow, not on top of it.
- **Vertical mask** fades the band out at the top and bottom of the hero so it never ends in a horizontal cut.
- Dark theme: the over-pass uses `normal` blend at 50%, because `multiply` on near-black does nothing.

### Card stock (layer 2)

Thickness is shown by stacked hard shadows (the cut edge), then one soft drop for the lift:

```css
--shadow-sheet:
  0 0 0 .5px rgba(0,0,0,.07),            /* cut edge outline */
  0 1.5px 0 var(--edge-1),               /* first ply */
  0 3px 0 -.5px var(--edge-2),           /* second ply, slightly inset */
  0 26px 44px -26px rgba(0,0,0,.5);      /* lift: long, tight, below only */
```

- The soft drop uses a **negative spread equal to its offset**, so the shadow appears only beneath the card and never as a halo on the sides.
- Rotate the sheet (−1.2°). A perfectly level sheet reads as a div.
- One sheet per screen. Don't add `shadow-sheet` to rows, buttons or images.

### Letterpress impression (layer 3)

Ink is pressed *into* the card, so each stroke has a lit lower lip (the far wall of the impression catches the window light):

```css
.press      { text-shadow: 0 1px 0 var(--press-hi);   /* light: rgba(255,255,255,.95) · dark: rgba(0,0,0,.6) */
              mask-image: var(--tex-ink); }
.press-svg  { filter: drop-shadow(0 1px 0 var(--press-hi));
              mask-image: var(--tex-ink); }
```

Ink speckle mask (uneven ink coverage), 160px tile:

```xml
<feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" stitchTiles="stitch"/>
<feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.4 .38"/>  <!-- alpha ≈ .6–1 -->
```

Offset is always **+1px on Y** (light from above). Never use a dark offset above the stroke on light themes: it turns deboss into emboss.

### Motion

The sheet settles into place once on load (`rotate(-4deg) translateY(10px)` → `rotate(-1.2deg)`, 1.1s, `cubic-bezier(.2,.7,.2,1)`). Disabled under `prefers-reduced-motion`. Nothing else moves except arrows nudging 6px on row hover.

## Shapes

- Paper is cut square: `rounded.none` everywhere, `rounded.xs` (1px) only on the sheet to soften the die-cut corner.
- The only glyph is a thin right arrow: a horizontal stroke plus a 45° open chevron, square caps, stroke weight matching the display font.
- No pills, no circles, no icons.

## Components

- **sheet**: the hero card. `card` background, card-stock tooth, sheen, `shadow-sheet`, −1.2° rotation, name zone / hairline / detail zone.
- **hairline**: 1px `primary`. Splits the sheet and underlines section labels.
- **row-divider**: 1px `line-soft` between list rows.
- **window-shadow**: the two-pass diagonal described above; only in the hero.
- **button-outline**: 1px ink border, square, label typography; inverts to ink fill on hover.

## Do's and Don'ts

- **Do** keep every light source consistent: top-left (azimuth 225°, Y +1px lip, 118° shadow).
- **Do** use different tile sizes for each noise layer so repeats don't align.
- **Do** check dark theme separately. Textures switch to `overlay` with remaps centred on 0.5.
- **Don't** push `surfaceScale` above ~2 or remap the flat surface below .93: it becomes stucco or concrete.
- **Don't** use bitmap paper JPGs. They tile visibly, scale badly and ignore theme.
- **Don't** apply letterpress to body text or anything under ~13px.
- **Don't** put more than one shadowed sheet on a screen, and don't use the window shadow outside the hero.
- **Don't** introduce an accent colour. Emphasis comes from size, weight and the material.
