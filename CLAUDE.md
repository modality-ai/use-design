# Claude Instructions — use-figma-cli

## Theme Fix Order Principle

When a theme looks wrong, always fix in this order. Never skip steps.

**1. `DESIGN.md` → `data/themes/<name>.yaml`**

Check the design reference first. Update the token value in the YAML — this is the single source of truth for colors, fonts, spacing, radius and components.

The YAML follows the W3C DTCG 2025.10 format (`$type`, `$value`, `$description`, `$extensions`):

- Top-level groups: `color`, `font`, `radius`, `spacing`, `component`.
- Colors are sRGB objects (`colorSpace`, `components`, `alpha?`, `hex`). Spacing and radius are px dimension objects.
- Spacing px values must be multiples of 2px (radius is exempt).
- Light/dark pairs live in `$extensions["use-design.mode"]`: the light value is `$value`, dark is under `.dark`.
- Typography is a composite `typography` token; font feature/variation settings go under `use-design.font`.
- Theme metadata (`name`, `version`) lives in `$extensions["use-design.theme"]`.
- A raw CSS override for a color token (e.g. `transparent`) goes under `$extensions["use-design.css"]`.
- Aliases use `{group.token}` references and must resolve.

**2. `data/themes/<name>.yaml` → TailwindCSS**

Run `bun run build:web`. The build validates the YAML, generates a `@theme static {}` block of CSS custom properties (`static` makes Tailwind v4 emit every token instead of tree-shaking unused ones), combines it with the component CSS, and compiles the output via TailwindCSS automatically.

```
DESIGN.md → data/themes/<name>.yaml → bun run build:web → public/styles/themes/<name>.css
```

`bun run build` compiles the CLI itself into `dist` (it is not the theme build).

**Do not edit any CSS directly.** Both `src/styles/components/*.css` and `public/styles/themes/*.css` are part of the TailwindCSS compilation chain — they are not edited by hand.

### What goes where

| Change needed | Where to fix |
|---|---|
| Wrong color, font, spacing or radius value | `data/themes/<name>.yaml` |
| Wrong HTML structure or button classes | `src/client/components/*.tsx` |
| Generated output looks wrong | Re-run `bun run build:web`, never edit CSS directly |
