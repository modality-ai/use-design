import { z } from "zod/v4";

const cssColor = z
  .string()
  .refine(
    (v) =>
      /^(#[0-9a-fA-F]{3,8}|rgba?\(.+\)|hsla?\(.+\)|oklch\(.+\)|color-mix\(.+\)|transparent|currentColor|inherit)$/.test(
        v.trim()
      ),
    { message: "Must be a valid CSS color value" }
  );

const cssLength = z
  .string()
  .refine((v) => /^\d+(\.\d+)?(px|rem|em|%)$/.test(v.trim()), {
    message: "Must be a valid CSS length (e.g. 8px, 1rem)",
  });

// design.md spec (issue #13): per-token light/dark mode pair
// e.g. surface: { light: "#ffffff", dark: "#1b1a18" }
const colorModePair = z.object({ light: cssColor, dark: cssColor });

// A color leaf is either a static color or a light/dark mode pair
const colorLeaf = z.union([colorModePair, cssColor]);

// A color value is a leaf, or a nested record of leaves (one level deep)
const colorValue = z.union([
  colorModePair,
  cssColor,
  z.record(z.string(), colorLeaf),
]);

// design.md spec: Typography token — all fields optional, fontFamily is a plain string
const typographyToken = z.object({
  fontFamily: z.string().optional(),
  fontSize: cssLength.optional(),
  fontWeight: z.union([z.number(), z.string()]).optional(),
  lineHeight: z.union([cssLength, z.number()]).optional(),
  letterSpacing: cssLength.optional(),
  fontFeature: z.string().optional(),
  fontVariation: z.string().optional(),
});

export const themeSchema = z.object({
  version: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),

  colors: z.record(z.string(), colorValue),

  // design.md spec: map<token-name, Typography>
  typography: z.record(z.string(), typographyToken),

  // design.md spec: map<scale-level, Dimension | number>
  // number = Tailwind unit (1 unit = 4px): e.g. 2 → 8px, 4 → 16px, 8 → 32px
  rounded: z.record(z.string(), z.union([cssLength, z.number()])),

  // design.md spec: map<scale-level, Dimension | number>
  // number = Tailwind unit (1 unit = 4px): e.g. 1 → 4px, 4 → 16px, 16 → 64px
  spacing: z.record(z.string(), z.union([cssLength, z.number()])).optional(),

  // design.md spec: map<component-name, map<token-name, value>>
  components: z.record(z.string(), z.record(z.string(), z.string())).optional(),
});

export type ThemeConfig = z.infer<typeof themeSchema>;
export type ColorModePair = z.infer<typeof colorModePair>;
