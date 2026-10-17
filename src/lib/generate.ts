import { parse as parseYaml } from "yaml";
import {
  themeSchema,
  walkTokens,
  resolveToken,
  GROUPS,
  MODE_EXT,
  FONT_EXT,
  CSS_EXT,
  type ThemeConfig,
  type TokenEntry,
  type ColorValue,
} from "./schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert camelCase to kebab-case for CSS custom property names. */
function toKebab(s: string): string {
  return s.replace(/([A-Z])/g, (c) => `-${c.toLowerCase()}`);
}

function cssVar(path: string[]): string {
  return `--${path.map(toKebab).join("-")}`;
}

/** Emit a DTCG color as CSS: hex when opaque, rgb(r g b / a) otherwise. */
function colorToCss(c: ColorValue): string {
  if (c.alpha === undefined || c.alpha === 1) return c.hex;
  const [r, g, b] = c.components.map((v) => Math.round(v * 255));
  return `rgb(${r} ${g} ${b} / ${c.alpha})`;
}

function dimToCss(d: { value: number; unit: string }): string {
  return `${d.value}${d.unit}`;
}

function familyToCss(v: unknown): string {
  return Array.isArray(v) ? v.join(", ") : String(v);
}

type Ctx = { root: Record<string, unknown> };

function resolve(ctx: Ctx, entry: TokenEntry): TokenEntry {
  const r = resolveToken(ctx.root, entry);
  if (!r) throw new Error(`Unresolvable alias at ${entry.path.join(".")}`);
  return r;
}

/** Plain-value token (everything except typography) as a CSS value. */
function valueToCss(entry: TokenEntry): string {
  const override = entry.token.$extensions?.[CSS_EXT];
  if (typeof override === "string") return override;
  const v = entry.token.$value as any;
  switch (entry.type) {
    case "color":
      return colorToCss(v);
    case "dimension":
      return dimToCss(v);
    case "fontFamily":
      return familyToCss(v);
    default:
      return String(v);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate the @theme {} block. Colors with a light/dark pair emit the dark
 * value here (dark-first); light values go to generateColorModeOverrides.
 */
export function generateThemeBlock(config: ThemeConfig): string {
  const ctx: Ctx = { root: config.root };
  const lines: string[] = [];
  const all = walkTokens(config.root);

  for (const group of GROUPS) {
    const entries = all.filter((e) => e.path[0] === group);

    if (group === "color") {
      const statics: string[] = [];
      const modes: string[] = [];
      for (const e of entries) {
        const r = resolve(ctx, e);
        const dark = (e.token.$extensions?.[MODE_EXT] ?? r.token.$extensions?.[MODE_EXT]) as
          | { dark: ColorValue }
          | undefined;
        if (dark) modes.push(`  ${cssVar(e.path)}: ${colorToCss(dark.dark)};`);
        else statics.push(`  ${cssVar(e.path)}: ${valueToCss({ ...r, type: "color" })};`);
      }
      lines.push(...statics, ...modes);
      continue;
    }

    for (const e of entries) {
      const r = resolve(ctx, e);
      const name = cssVar(e.path);
      if (r.type !== "typography") {
        lines.push(`  ${name}: ${valueToCss(r)};`);
        continue;
      }
      const t = r.token.$value as Record<string, any>;
      const ext = (r.token.$extensions?.[FONT_EXT] ?? {}) as Record<string, string>;
      if (t.fontFamily !== undefined) lines.push(`  ${name}: ${familyToCss(t.fontFamily)};`);
      if (t.fontSize) lines.push(`  ${name}-size: ${dimToCss(t.fontSize)};`);
      if (t.fontWeight !== undefined) lines.push(`  ${name}-weight: ${t.fontWeight};`);
      if (t.lineHeight !== undefined) lines.push(`  ${name}-line-height: ${t.lineHeight};`);
      if (t.letterSpacing) lines.push(`  ${name}-letter-spacing: ${dimToCss(t.letterSpacing)};`);
      if (ext.feature) lines.push(`  ${name}-feature: ${ext.feature};`);
      if (ext.variation) lines.push(`  ${name}-variation: ${ext.variation};`);
    }
  }

  // `static` makes Tailwind v4 emit every token instead of tree-shaking the ones
  // no utility references, so the compiled CSS exposes the full theme deterministically.
  return `@theme static {\n${lines.join("\n")}\n}`;
}

/**
 * Light-mode CSS overrides for every color token with a use-design.mode pair.
 * Emits both an OS-preference media query and a [data-theme="light"] selector.
 * Returns null when no mode-aware colors are defined.
 */
export function generateColorModeOverrides(config: ThemeConfig): string | null {
  const ctx: Ctx = { root: config.root };
  const modes = walkTokens(config.root)
    .filter((e) => e.path[0] === "color")
    .filter((e) => {
      const r = resolve(ctx, e);
      return e.token.$extensions?.[MODE_EXT] ?? r.token.$extensions?.[MODE_EXT];
    })
    .map((e) => ({ name: cssVar(e.path), light: valueToCss({ ...resolve(ctx, e), type: "color" }) }));

  if (modes.length === 0) return null;

  const vars = modes.map(({ name, light }) => `    ${name}: ${light};`).join("\n");

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
    modes.map(({ name, light }) => `  ${name}: ${light};`).join("\n"),
    `}`,
  ].join("\n");
}

/** Parse a YAML theme file and validate it as a DTCG theme. */
export function loadThemeConfig(yamlContent: string, filePath?: string): ThemeConfig {
  const result = themeSchema.safeParse(parseYaml(yamlContent));

  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Theme validation failed${filePath ? ` (${filePath})` : ""}:\n${errors}`);
  }

  return result.data;
}

/**
 * Replace hardcoded values inside button rules with var(--component-*)
 * references, keeping the component CSS untouched on disk.
 */
function applyComponentTokensToCss(css: string, root: Record<string, unknown>): string {
  const component = root.component as Record<string, Record<string, unknown>> | undefined;
  const btn = component?.["button-primary"];
  if (!btn) return css;

  const btnSelectors = [".btn-primary", ".btn-secondary", ".btn-pill-outline", ".btn-pill-outline-dark"];

  const propMap: Record<string, string> = {
    fontSize: "font-size",
    letterSpacing: "letter-spacing",
    minWidth: "min-width",
    padding: "padding",
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

  return result;
}

/**
 * Produce the final CSS: tailwind import, header comment, @theme block,
 * light-mode overrides (if any) and the processed component styles.
 */
export function buildThemeCss(yamlContent: string, componentCss: string, filePath?: string): string {
  const config = loadThemeConfig(yamlContent, filePath);
  const themeBlock = generateThemeBlock(config);
  const modeOverrides = generateColorModeOverrides(config);
  const header = `/*\n * ${config.name} Theme\n * ${config.description?.trim() ?? ""}\n * Auto-generated from YAML config — do not edit directly.\n */`;

  const processedCss = applyComponentTokensToCss(componentCss, config.root);

  const parts = [`@import "tailwindcss";`, ``, header, ``, themeBlock];
  if (modeOverrides) parts.push(``, modeOverrides);
  parts.push(``, processedCss);

  return parts.join("\n");
}
