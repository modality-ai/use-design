import { parse as parseYaml } from "yaml";
import { themeSchema, type ThemeConfig, type ColorModePair } from "./schema";

// ─── Internal types ───────────────────────────────────────────────────────────

type ColorLeaf = string | ColorModePair;
type ColorValue = ColorLeaf | Record<string, ColorLeaf>;

type StaticColorEntry = { cssVar: string; value: string };
type ModeColorEntry   = { cssVar: string; light: string; dark: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert camelCase to kebab-case for CSS custom property names. */
function toKebab(s: string): string {
  return s.replace(/([A-Z])/g, (c) => `-${c.toLowerCase()}`);
}

/**
 * Convert a Tailwind-style unit value to a CSS pixel string.
 *
 * Numeric values follow the Tailwind spacing convention: 1 unit = 4px.
 * String values with explicit units are returned unchanged.
 *
 * @example toPx(4)      → "16px"   (4 * 4px)
 * @example toPx(1.5)    → "6px"    (1.5 * 4px)
 * @example toPx("16px") → "16px"   (passthrough)
 * @example toPx("1rem") → "1rem"   (passthrough)
 */
export function toPx(value: number | string): string {
  if (typeof value === "number") return `${value * 4}px`;
  return value;
}

/** Return true if the value is a { light, dark } mode pair. */
function isModePair(v: unknown): v is ColorModePair {
  return (
    typeof v === "object" &&
    v !== null &&
    "light" in v &&
    "dark" in v &&
    typeof (v as ColorModePair).light === "string" &&
    typeof (v as ColorModePair).dark === "string"
  );
}

/**
 * Flatten a color map into static entries and mode-aware entries.
 *
 * Static entries go directly into @theme {}.
 * Mode entries emit dark as the default and light as the override.
 *
 * e.g.
 *   { accent: "#DA291C" }
 *     → statics: [{ cssVar: "--color-accent", value: "#DA291C" }]
 *
 *   { surface: { light: "#fff", dark: "#000" } }
 *     → modes: [{ cssVar: "--color-surface", light: "#fff", dark: "#000" }]
 *
 *   { bg: { primary: "#000", on-dark: { light: "#000", dark: "#fff" } } }
 *     → statics: [{ cssVar: "--color-bg-primary", value: "#000" }]
 *        modes:   [{ cssVar: "--color-bg-on-dark", light: "#000", dark: "#fff" }]
 */
function flattenColorEntries(
  obj: Record<string, ColorValue>,
  prefix = "--color"
): { statics: StaticColorEntry[]; modes: ModeColorEntry[] } {
  const statics: StaticColorEntry[] = [];
  const modes: ModeColorEntry[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const cssVar = `${prefix}-${key}`;

    if (typeof value === "string") {
      statics.push({ cssVar, value });
    } else if (isModePair(value)) {
      modes.push({ cssVar, light: value.light, dark: value.dark });
    } else {
      // Nested record — recurse one level deep
      const nested = flattenColorEntries(value as Record<string, ColorLeaf>, cssVar);
      statics.push(...nested.statics);
      modes.push(...nested.modes);
    }
  }

  return { statics, modes };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate the @theme {} block from a validated ThemeConfig.
 * Mode-aware colors use the dark value as the default.
 */
export function generateThemeBlock(config: ThemeConfig): string {
  const lines: string[] = [];
  const { statics, modes } = flattenColorEntries(config.colors);

  // Static colors
  for (const { cssVar, value } of statics) {
    lines.push(`  ${cssVar}: ${value};`);
  }
  // Mode-aware colors: dark is default (most themes in this project are dark-first)
  for (const { cssVar, dark } of modes) {
    lines.push(`  ${cssVar}: ${dark};`);
  }

  // Typography — design.md spec: --font-<name>[-<prop>]
  for (const [name, token] of Object.entries(config.typography)) {
    if (token.fontFamily)              lines.push(`  --font-${name}: ${token.fontFamily};`);
    if (token.fontSize)                lines.push(`  --font-${name}-size: ${token.fontSize};`);
    if (token.fontWeight !== undefined) lines.push(`  --font-${name}-weight: ${token.fontWeight};`);
    if (token.lineHeight !== undefined) lines.push(`  --font-${name}-line-height: ${token.lineHeight};`);
    if (token.letterSpacing)           lines.push(`  --font-${name}-letter-spacing: ${token.letterSpacing};`);
    if (token.fontFeature)             lines.push(`  --font-${name}-feature: ${token.fontFeature};`);
    if (token.fontVariation)           lines.push(`  --font-${name}-variation: ${token.fontVariation};`);
  }

  // Rounded — design.md spec: --radius-<key> (Tailwind v4 compatible)
  for (const [key, value] of Object.entries(config.rounded)) {
    lines.push(`  --radius-${key}: ${toPx(value)};`);
  }

  // Spacing — design.md spec: --spacing-<key>
  if (config.spacing) {
    for (const [key, value] of Object.entries(config.spacing)) {
      lines.push(`  --spacing-${key}: ${toPx(value)};`);
    }
  }

  // Components — design.md spec: --component-<name>-<kebab-prop>
  if (config.components) {
    for (const [name, tokens] of Object.entries(config.components)) {
      for (const [prop, value] of Object.entries(tokens)) {
        lines.push(`  --component-${name}-${toKebab(prop)}: ${value};`);
      }
    }
  }

  return `@theme {\n${lines.join("\n")}\n}`;
}

/**
 * Generate light-mode CSS overrides for all mode-aware color tokens.
 *
 * Emits two selectors so consumers can choose either strategy:
 *   1. @media (prefers-color-scheme: light) — respects OS preference automatically
 *   2. [data-theme="light"]                 — explicit user override via JS
 *
 * Returns null when no mode-aware colors are defined.
 */
export function generateColorModeOverrides(config: ThemeConfig): string | null {
  const { modes } = flattenColorEntries(config.colors);
  if (modes.length === 0) return null;

  const vars = modes.map(({ cssVar, light }) => `    ${cssVar}: ${light};`).join("\n");

  return [
    `/* Light mode overrides — auto (OS preference) */`,
    `@media (prefers-color-scheme: light) {`,
    `  :root {`,
    vars,
    `  }`,
    `}`,
    ``,
    `/* Light mode overrides — explicit ([data-theme="light"] on <html>) */`,
    `[data-theme="light"] {`,
    modes.map(({ cssVar, light }) => `  ${cssVar}: ${light};`).join("\n"),
    `}`,
  ].join("\n");
}

/**
 * Load a YAML theme file, validate with Zod, return the ThemeConfig.
 */
export function loadThemeConfig(yamlContent: string, filePath?: string): ThemeConfig {
  const raw = parseYaml(yamlContent);
  const result = themeSchema.safeParse(raw);

  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Theme validation failed${filePath ? ` (${filePath})` : ""}:\n${errors}`
    );
  }

  return result.data;
}

/**
 * Apply component tokens from YAML to component CSS by replacing hardcoded
 * values inside button rules with var(--component-*) references.
 *
 * This keeps the component CSS untouched on disk (Theme Fix Order Principle)
 * while the build pipeline injects the correct token references.
 */
function applyComponentTokensToCss(
  css: string,
  components?: Record<string, Record<string, string>>
): string {
  if (!components) return css;

  const btn = components["button-primary"];
  if (!btn) return css;

  const btnSelectors = [
    ".btn-primary",
    ".btn-secondary",
    ".btn-pill-outline",
    ".btn-pill-outline-dark",
  ];

  const propMap: Record<string, string> = {
    fontSize: "font-size",
    letterSpacing: "letter-spacing",
    minWidth: "min-width",
  };

  let result = css;

  for (const [prop, cssProp] of Object.entries(propMap)) {
    if (!(prop in btn)) continue;
    const varRef = `var(--component-button-primary-${toKebab(prop)})`;
    for (const sel of btnSelectors) {
      const escaped = sel.replace(".", "\\.");
      const blockRe = new RegExp(`(${escaped}\\s*\\{[^}]*?)${cssProp}:\\s*[^;]+;`, "g");
      result = result.replace(blockRe, `$1${cssProp}: ${varRef};`);
    }
  }

  if ("padding" in btn) {
    const padVar = `var(--component-button-primary-padding)`;
    for (const sel of btnSelectors) {
      const escaped = sel.replace(".", "\\.");
      const padRe = new RegExp(`(${escaped}\\s*\\{[^}]*?)padding:\\s*[^;]+;`, "g");
      result = result.replace(padRe, `$1padding: ${padVar};`);
    }
  }

  return result;
}

/**
 * Given a theme YAML string and the component CSS string, produce the final CSS:
 *   @import "tailwindcss"
 *   + header comment
 *   + @theme {} block (dark-first defaults)
 *   + light mode overrides (if any mode-aware colors exist)
 *   + component styles
 */
export function buildThemeCss(yamlContent: string, componentCss: string, filePath?: string): string {
  const config = loadThemeConfig(yamlContent, filePath);
  const themeBlock = generateThemeBlock(config);
  const modeOverrides = generateColorModeOverrides(config);
  const header = `/*\n * ${config.name} Theme\n * ${config.description?.trim() ?? ""}\n * Auto-generated from YAML config — do not edit directly.\n */`;

  const processedCss = applyComponentTokensToCss(componentCss, config.components);

  const parts = [`@import "tailwindcss";`, ``, header, ``, themeBlock];
  if (modeOverrides) parts.push(``, modeOverrides);
  parts.push(``, processedCss);

  return parts.join("\n");
}
