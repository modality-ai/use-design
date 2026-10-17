import { z } from "zod/v4";

/**
 * Theme files follow the W3C Design Tokens Format Module (DTCG 2025.10).
 * Project-specific data lives in namespaced `$extensions`:
 *   use-design.theme  root: { name, version }
 *   use-design.mode   color token: { dark: <color> }  ($value is the light value)
 *   use-design.font   typography token: { feature, variation }
 */
export const THEME_EXT = "use-design.theme";
export const MODE_EXT = "use-design.mode";
export const FONT_EXT = "use-design.font";
/** Color token: CSS text emitted instead of the generated value (e.g. `transparent`). */
export const CSS_EXT = "use-design.css";

/** Top-level groups. They double as the CSS variable prefixes. */
export const GROUPS = ["color", "font", "radius", "spacing", "component"] as const;
const REQUIRED_GROUPS = ["color", "font", "radius"];

// ─── Value schemas ────────────────────────────────────────────────────────────

const num = z.number();

export const dimensionValue = z.object({
  value: num,
  unit: z.enum(["px", "rem"]),
});

export const colorValue = z.object({
  colorSpace: z.literal("srgb"),
  components: z.tuple([num, num, num]),
  alpha: num.min(0).max(1).optional(),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "hex must be #rrggbb"),
});

const fontFamilyValue = z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]);
const fontWeightValue = z.union([num.min(1).max(1000), z.string().min(1)]);

const typographyValue = z.object({
  fontFamily: fontFamilyValue.optional(),
  fontSize: dimensionValue.optional(),
  fontWeight: fontWeightValue.optional(),
  lineHeight: num.optional(),
  letterSpacing: dimensionValue.optional(),
});

const VALUE_SCHEMAS: Record<string, z.ZodType> = {
  color: colorValue,
  dimension: dimensionValue,
  fontFamily: fontFamilyValue,
  fontWeight: fontWeightValue,
  number: num,
  typography: typographyValue,
  // Not a DTCG type: plain CSS text where no DTCG type fits (e.g. padding).
  string: z.string(),
};

export type ColorValue = z.infer<typeof colorValue>;
export type DimensionValue = z.infer<typeof dimensionValue>;

// ─── Tree helpers ─────────────────────────────────────────────────────────────

export type Token = {
  $type?: string;
  $value: unknown;
  $description?: string;
  $extensions?: Record<string, unknown>;
};
export type TokenEntry = { path: string[]; token: Token; type?: string };

const ALIAS_RE = /^\{([^{}]+)\}$/;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function isToken(node: unknown): node is Token {
  return isObject(node) && "$value" in node;
}

export function aliasTarget(value: unknown): string[] | null {
  if (typeof value !== "string") return null;
  const m = ALIAS_RE.exec(value);
  return m ? m[1]!.split(".") : null;
}

/** Depth-first list of every token, with its $type inherited from groups. */
export function walkTokens(
  node: Record<string, unknown>,
  path: string[] = [],
  inherited?: string
): TokenEntry[] {
  const type = typeof node.$type === "string" ? node.$type : inherited;
  const out: TokenEntry[] = [];
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$") || !isObject(child)) continue;
    const childPath = [...path, key];
    if (isToken(child)) {
      const ownType = typeof child.$type === "string" ? child.$type : type;
      out.push({ path: childPath, token: child, type: ownType });
    } else {
      out.push(...walkTokens(child, childPath, type));
    }
  }
  return out;
}

/** Follow `{a.b.c}` aliases to the concrete token (null if broken or cyclic). */
export function resolveToken(
  root: Record<string, unknown>,
  entry: TokenEntry,
  seen = new Set<string>()
): TokenEntry | null {
  const target = aliasTarget(entry.token.$value);
  if (!target) return entry;
  const key = target.join(".");
  if (seen.has(key)) return null;
  seen.add(key);
  const found = walkTokens(root).find((e) => e.path.join(".") === key);
  if (!found) return null;
  const resolved = resolveToken(root, found, seen);
  return resolved && { ...resolved, type: entry.type ?? resolved.type };
}

// ─── Theme schema ─────────────────────────────────────────────────────────────

export type ThemeConfig = {
  name: string;
  version?: string;
  description?: string;
  root: Record<string, unknown>;
};

export const themeSchema = z
  .record(z.string(), z.unknown())
  .superRefine((root, ctx) => {
    const add = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });

    const meta = isObject(root.$extensions) ? root.$extensions[THEME_EXT] : undefined;
    if (!isObject(meta) || typeof meta.name !== "string" || meta.name.length === 0) {
      add(["$extensions", THEME_EXT, "name"], "Theme name is required");
    }

    for (const g of REQUIRED_GROUPS) {
      if (!isObject(root[g])) add([g], `Required group "${g}" is missing`);
    }

    const checkNames = (node: Record<string, unknown>, path: string[]) => {
      for (const [key, child] of Object.entries(node)) {
        if (key.startsWith("$") || !isObject(child)) continue;
        if (/[{}.]/.test(key)) add([...path, key], `Name "${key}" must not contain { } or .`);
        if (!isToken(child)) checkNames(child, [...path, key]);
      }
    };
    checkNames(root, []);

    for (const { path, token, type } of walkTokens(root)) {
      const where = path.join(".");
      const target = aliasTarget(token.$value);
      if (target) {
        if (!resolveToken(root, { path, token, type })) {
          add(path, `Alias ${token.$value} at ${where} does not resolve`);
        }
        continue;
      }
      if (!type) {
        add(path, `Token ${where} has no $type (set it on the token or a parent group)`);
        continue;
      }
      const schema = VALUE_SCHEMAS[type];
      if (!schema) {
        add(path, `Unknown $type "${type}" at ${where}`);
        continue;
      }
      const parsed = schema.safeParse(token.$value);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          add([...path, "$value", ...issue.path.map(String)], issue.message);
        }
        continue;
      }

      const mode = token.$extensions?.[MODE_EXT];
      if (mode !== undefined) {
        const dark = isObject(mode) ? colorValue.safeParse(mode.dark) : null;
        if (type !== "color" || !dark?.success) {
          add([...path, "$extensions", MODE_EXT], `${MODE_EXT} needs a valid color "dark"`);
        }
      }

      const css = token.$extensions?.[CSS_EXT];
      if (css !== undefined && (type !== "color" || typeof css !== "string" || css.length === 0)) {
        add([...path, "$extensions", CSS_EXT], `${CSS_EXT} must be a non-empty string on a color token`);
      }

      // Spacing must sit on the Tailwind scale: px, multiples of 2px (0.5 unit)
      if (path[0] === "spacing") {
        const d = dimensionValue.safeParse(token.$value);
        if (!d.success || d.data.unit !== "px" || !Number.isInteger(d.data.value / 2)) {
          add(path, `Spacing ${where} must be px and a multiple of 2px (Tailwind scale)`);
        }
      }
    }
  })
  .transform((root): ThemeConfig => {
    const meta = (root.$extensions as Record<string, any>)[THEME_EXT];
    return {
      name: meta.name,
      version: meta.version,
      description: typeof root.$description === "string" ? root.$description : undefined,
      root,
    };
  });
