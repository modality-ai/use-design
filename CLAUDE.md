# Claude Instructions — use-figma-cli

## Theme Fix Order Principle

When a theme looks wrong, always fix in this order. Never skip steps.

**1. `DESIGN.md` → `data/themes/<name>.yaml`**

Check the design reference first. Update the token value in the YAML — this is the single source of truth for colors, fonts, and radius.

**2. `data/themes/<name>.yaml` → TailwindCSS**

Run `bun run build`. The build reads the YAML, generates a `@theme {}` block of CSS custom properties, combines it with the component CSS, and compiles the output via TailwindCSS automatically.

```
DESIGN.md → data/themes/<name>.yaml → bun run build → public/styles/themes/<name>.css
```

**Do not edit any CSS directly.** Both `src/styles/components/*.css` and `public/styles/themes/*.css` are part of the TailwindCSS compilation chain — they are not edited by hand.

### What goes where

| Change needed | Where to fix |
|---|---|
| Wrong color, font, or radius value | `data/themes/<name>.yaml` |
| Wrong HTML structure or button classes | `src/client/components/*.tsx` |
| Generated output looks wrong | Re-run `bun run build`, never edit CSS directly |
