---
name: JoSAA Rank Analysis
description: A fast, tactile, Linear-caliber rank-analysis tool for historical JoSAA cutoff data.
colors:
  ink: "#171717"
  text: "#262626"
  muted-text: "#6b7280"
  app-bg: "#f6f7f9"
  surface: "#ffffff"
  surface-raised: "#fcfcfd"
  surface-subtle: "#f1f3f5"
  line: "#e5e7eb"
  line-strong: "#d1d5db"
  primary: "#18181b"
  primary-hover: "#27272a"
  focus: "#2563eb"
  focus-soft: "#dbeafe"
  possible-bg: "#ecfdf3"
  possible-text: "#166534"
  possible-border: "#bbf7d0"
  not-possible-bg: "#fff1f2"
  not-possible-text: "#be123c"
  not-possible-border: "#fecdd3"
  no-data-bg: "#f3f4f6"
  no-data-text: "#4b5563"
  warning-bg: "#fffbeb"
  warning-text: "#92400e"
  error-bg: "#fef2f2"
  error-border: "#fecaca"
  error-text: "#b91c1c"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "2rem"
    fontWeight: 650
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "0"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0"
rounded:
  control: "8px"
  surface: "10px"
  sheet: "12px"
  chip: "999px"
spacing:
  xxs: "4px"
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
    height: "36px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "8px 10px"
    height: "36px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "16px"
  status-pill:
    backgroundColor: "{colors.no-data-bg}"
    textColor: "{colors.no-data-text}"
    rounded: "{rounded.chip}"
    padding: "4px 9px"
---

# Design System: JoSAA Rank Analysis

## 1. Overview

**Creative North Star: "The Allocation Console"**

This system should feel as composed and fast as Linear: precise, quiet, tactile, and beautiful because every surface helps the user move faster. JoSAA Rank Analysis is still a counselling tool, but the visual target is a modern product console rather than a school-admissions site. It should make the student feel that the data is under control.

The purple identity is retired. The new direction is a unified graphite and cool-neutral palette with sparse semantic color. Primary actions use near-black graphite, focus uses a crisp blue ring, and status colors are muted enough to sit inside dense rows without turning the table into a traffic-light display.

Use shadcn/ui as the component baseline even though the original MVP spec avoided component libraries. The desired feel is shadcn's practical vocabulary: Button, Input, Select, Checkbox, Badge, Card, Sheet, Table, Tooltip, Skeleton, and Toast primitives, composed with a tighter product rhythm and stronger tactile elevation.

**Key Characteristics:**

- Graphite-led neutral palette with no purple.
- Dense, fast, Linear-like product ergonomics.
- Tactile raised surfaces with clean borders and calibrated shadows.
- shadcn-style primitives, not custom-looking form controls.
- Semantic status colors used sparingly and always paired with text.
- Mobile cards and desktop tables stay semantically equivalent.

## 2. Colors

The palette is unified and cool-neutral: graphite for command, white for working surfaces, soft greys for hierarchy, blue only for focus, and muted semantic color for data status.

### Primary

- **Graphite Command** (`primary`): primary buttons, selected command states, and the strongest text-on-action treatment.
- **Graphite Hover** (`primary-hover`): hover and pressed state for primary actions.
- **Focus Blue** (`focus`): keyboard focus rings, active field borders, and link affordances when a link is needed. Do not use it as a decorative accent.
- **Focus Wash** (`focus-soft`): subtle focus-adjacent backgrounds, selected rows, and active filter surfaces.

### Neutral

- **Console Ink** (`ink`): headings and highest-priority text.
- **Body Graphite** (`text`): body text, table text, labels that need stronger contrast, and button text on light surfaces.
- **Muted Graphite** (`muted-text`): secondary labels, metadata, and low-emphasis helper text.
- **App Field** (`app-bg`): page background. It should feel like an application canvas, not paper, cream, or purple tint.
- **Working Surface** (`surface`): shadcn Card, Popover, Sheet, and Table surfaces.
- **Raised Surface** (`surface-raised`): cards and panels that need tactile lift without color noise.
- **Subtle Surface** (`surface-subtle`): table headers, option groups, filter summaries, and skeletons.
- **Hairline** (`line`): default border.
- **Pressed Hairline** (`line-strong`): hover, active, and selected borders.

### Tertiary

- **Possible Green** (`possible-bg`, `possible-text`, `possible-border`): possible rows, badges, and summary counts.
- **Reach Rose** (`not-possible-bg`, `not-possible-text`, `not-possible-border`): not-possible rows and reach badges.
- **No Data Grey** (`no-data-bg`, `no-data-text`): missing cutoff states.
- **Warning Amber** (`warning-bg`, `warning-text`): historical-data disclaimers and non-blocking caveats.
- **Error Red** (`error-bg`, `error-border`, `error-text`): validation and load failures only.

### Named Rules

**The No Purple Rule.** Purple is prohibited in the future visual system. If a token or component still uses violet, it is legacy debt to remove during implementation.

**The Semantic Restraint Rule.** Green, rose, amber, and blue appear only when they carry meaning: result status, focus, warning, or error.

**The Unified Surface Rule.** Every neutral should feel like part of one material system. Do not mix warm cream, cold blue-grey, and tinted purple neutrals.

## 3. Typography

**Display Font:** Inter with system UI fallbacks.
**Body Font:** Inter with system UI fallbacks.
**Label/Mono Font:** No separate label or mono family is currently required.

**Character:** Typography should feel like a refined product console: compact, controlled, and quick to scan. Avoid oversized hero-style text. This product wins through density and rhythm, not theatrical headings.

### Hierarchy

- **Display** (650, `2rem`, 1.1): page title and rare top-level context only.
- **Headline** (650, `1.125rem`, 1.25): panel, sheet, and summary headings.
- **Title** (600, `0.95rem`, 1.3): result card titles, table section names, and compact module names.
- **Body** (400 to 500, `0.875rem`, 1.45): table cells, card copy, details, and helper text. Long prose should stay under 75ch.
- **Label** (600, `0.75rem`, 1.2): form labels, table headers, badges, and compact metadata.

### Named Rules

**The Linear Density Rule.** Use small, clear type with strong spacing discipline. Large display type is a liability in this product.

**The Single Sans Rule.** Do not add decorative serif, mono-forward, or display-font treatments. One precise sans family is enough.

## 4. Elevation

The target is more tactile and lifted than the current flat MVP, but still product-grade. Use shadcn-like borders plus calibrated shadows that make panels feel touchable without looking decorative. Lift should signal hierarchy: filter shell, result surface, summary panel, sheet, toast, and popover all occupy distinct layers.

### Shadow Vocabulary

- **Control Hairline** (`0 1px 1px rgba(17, 24, 39, 0.04)`): buttons, inputs, selects, and badges.
- **Panel Lift** (`0 1px 2px rgba(17, 24, 39, 0.06), 0 8px 24px rgba(17, 24, 39, 0.06)`): filter panel, results panel, summary panel, and cards.
- **Popover Lift** (`0 10px 28px rgba(17, 24, 39, 0.12)`): dropdowns, command-like search surfaces, and option menus.
- **Sheet Lift** (`0 24px 60px rgba(17, 24, 39, 0.18)`): right-side detail sheet and blocking overlays.
- **Focus Ring** (`0 0 0 3px rgba(37, 99, 235, 0.18)`): keyboard focus and active fields.

### Named Rules

**The Tactile Stack Rule.** Resting controls get a hairline lift, panels get a soft two-layer lift, and sheets get the only strong shadow.

**The No Ghost Card Rule.** Shadows must be calibrated and purposeful. Do not combine random 1px borders with large blurry decorative shadows.

## 5. Components

### Buttons

- **Shape:** shadcn Button shape with 8px radius, 36px default height, compact horizontal padding.
- **Primary:** graphite background, white text, medium weight, hairline lift.
- **Hover / Focus:** hover darkens to `primary-hover`; focus uses `focus` ring. Motion should feel instant, 120ms to 180ms.
- **Secondary / Outline:** white surface, graphite text, `line` border, subtle hover background. Secondary actions should not be purple or blue.

### Chips

- **Style:** use shadcn Badge vocabulary: 999px pill radius, 4px to 9px padding, compact label text.
- **State:** status badges use semantic background, semantic text, and readable text. Filter badges use neutral surfaces unless selected.

### Cards / Containers

- **Corner Style:** 10px for panels and cards, 12px for sheets.
- **Background:** `surface` or `surface-raised`, never purple-tinted surfaces.
- **Shadow Strategy:** panels use Panel Lift; nested rows use borders or `surface-subtle` only.
- **Border:** `line` at rest, `line-strong` on hover or selection.
- **Internal Padding:** 12px for dense controls, 16px for panels, 20px for sheets.

### Inputs / Fields

- **Style:** shadcn Input and Select baseline: white fill, `line` border, 8px radius, 36px height, compact text.
- **Focus:** `focus` border plus Focus Ring.
- **Error / Disabled:** errors use semantic red; disabled controls use muted text and subtle surface, not opacity alone.

### Navigation

If navigation is added, use a Linear-like command surface: compact tabs or segmented controls, neutral active state, no hero nav, no large brand lockup. Active state can use graphite text plus subtle background.

### Results Table and Mobile Result Cards

The desktop Table should feel like a shadcn data table tuned for high volume: sticky header, precise row height, quiet separators, hover row, clear status badge, and right-aligned numeric rank columns. Mobile cards should use Card plus Badge plus compact metric rows, with the same status and round data as the table.

### Detail Sheet

Use shadcn Sheet for row details. It should be tactile and precise: 12px radius if inset, strong Sheet Lift, clear close button, structured key-value rows, and no routine filter changes inside the sheet.

### Loading, Empty, and Toast States

Use Skeleton for loading tables and cards instead of centered spinners where possible. Use Toast for copied share links and non-blocking messages. Empty states should explain the next action in one sentence, not decorate the page.

## 6. Do's and Don'ts

### Do:

- **Do** target Linear-level product polish: fast, quiet, tactile, and beautiful.
- **Do** migrate implementation toward shadcn/ui primitives even though the MVP spec said no component library.
- **Do** remove purple from future tokens and component states.
- **Do** use graphite neutrals, white raised surfaces, and sparse semantic color.
- **Do** use exact years, rounds, opening ranks, closing ranks, and no-cutoff labels.
- **Do** pair every possible, not possible, and no cutoff color with text.
- **Do** make controls feel tactile through calibrated border, shadow, hover, and focus states.
- **Do** keep mobile result cards equivalent to the desktop table.

### Don't:

- **Don't** preserve the current purple palette as brand identity.
- **Don't** use marketing-site treatment, decorative academic imagery, or vague admissions-coaching language.
- **Don't** imply prediction certainty. This is historical cutoff analysis, not an admissions guarantee.
- **Don't** clone the official JoSAA portal or style the app like a coaching-center lead form.
- **Don't** make a generic analytics dashboard detached from the student's rank decision.
- **Don't** rely on color alone for status meaning.
- **Don't** use warm cream, beige, sand, violet, glassmorphism, gradient text, or oversized landing-page hero sections.
- **Don't** let tactile elevation become decorative bulk. If a shadow does not clarify hierarchy, remove it.
