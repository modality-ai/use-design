import { describe, test, expect } from "bun:test";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { loadThemeConfig, generateThemeBlock, generateColorModeOverrides, toPx } from "../generate";
import { themeSchema } from "../schema";
import { parse as parseYaml } from "yaml";
import { THEMES_DIR } from "../../../const";

// ─── Discover all YAML theme files ───

async function getThemeFiles(): Promise<{ name: string; path: string }[]> {
  const files = await readdir(THEMES_DIR);
  return files
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => ({ name: f.replace(".yaml", ""), path: resolve(THEMES_DIR, f) }));
}

// ─── All themes: Zod validation ───

describe("Theme YAML Zod validation", () => {
  test("at least one theme YAML exists", async () => {
    const themes = await getThemeFiles();
    expect(themes.length).toBeGreaterThan(0);
  });

  test.each(["apple", "google"])("%s.yaml passes Zod schema", async (name) => {
    const yaml = await Bun.file(resolve(THEMES_DIR, `${name}.yaml`)).text();
    const config = loadThemeConfig(yaml, `${name}.yaml`);
    expect(config.name).toBeTruthy();
  });

  test("all YAML themes pass Zod schema", async () => {
    const themes = await getThemeFiles();
    for (const theme of themes) {
      const yaml = await Bun.file(theme.path).text();
      expect(() => loadThemeConfig(yaml, theme.path)).not.toThrow();
    }
  });
});

// ─── Required fields ───

describe("Theme required fields", () => {
  test.each(["apple", "google"])("%s.yaml has name, colors, typography, rounded", async (name) => {
    const yaml = await Bun.file(resolve(THEMES_DIR, `${name}.yaml`)).text();
    const config = loadThemeConfig(yaml, `${name}.yaml`);

    expect(config.name).toBeString();
    expect(config.name.length).toBeGreaterThan(0);
    expect(Object.keys(config.colors).length).toBeGreaterThan(0);
    expect(Object.keys(config.typography).length).toBeGreaterThan(0);
    expect(Object.keys(config.rounded).length).toBeGreaterThan(0);
  });
});

// ─── Color validation ───

describe("Theme color values", () => {
  test.each(["apple", "google"])("%s.yaml — all colors are valid CSS", async (name) => {
    const yaml = await Bun.file(resolve(THEMES_DIR, `${name}.yaml`)).text();
    const raw = parseYaml(yaml);
    const result = themeSchema.safeParse(raw);

    expect(result.success).toBe(true);
  });

  test("rejects invalid hex color", () => {
    const yaml = `
name: Bad
colors:
  accent: "not-a-color"
typography:
  body:
    fontFamily: "Arial, sans-serif"
rounded:
  sm: "4px"
`;
    expect(() => loadThemeConfig(yaml, "bad.yaml")).toThrow("Theme validation failed");
  });

  test("rejects empty color value", () => {
    const yaml = `
name: Bad
colors:
  accent: ""
typography:
  body:
    fontFamily: "Arial, sans-serif"
rounded:
  sm: "4px"
`;
    expect(() => loadThemeConfig(yaml, "bad.yaml")).toThrow();
  });

  test("accepts rgba color", () => {
    const yaml = `
name: Test
colors:
  shadow: "rgba(0, 0, 0, 0.5)"
typography:
  body:
    fontFamily: "Arial, sans-serif"
rounded:
  sm: "4px"
`;
    const config = loadThemeConfig(yaml);
    expect(config.colors["shadow"]).toBe("rgba(0, 0, 0, 0.5)");
  });

  test("accepts nested color objects", () => {
    const yaml = `
name: Test
colors:
  bg:
    primary: "#000000"
    secondary: "#ffffff"
typography:
  body:
    fontFamily: "Arial, sans-serif"
rounded:
  sm: "4px"
`;
    const config = loadThemeConfig(yaml);
    const bg = config.colors["bg"] as Record<string, string>;
    expect(bg["primary"]).toBe("#000000");
    expect(bg["secondary"]).toBe("#ffffff");
  });
});

// ─── Typography validation ───

describe("Theme typography values", () => {
  test("accepts fontFamily-only token", () => {
    const yaml = `
name: Test
colors:
  accent: "#000"
typography:
  body:
    fontFamily: '"Roboto", Arial, sans-serif'
rounded:
  sm: "4px"
`;
    const config = loadThemeConfig(yaml);
    expect(config.typography["body"]?.fontFamily).toContain("Roboto");
  });

  test("accepts full typography token", () => {
    const yaml = `
name: Test
colors:
  accent: "#000"
typography:
  h1:
    fontFamily: "Inter, sans-serif"
    fontSize: 48px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: 0.02em
rounded:
  sm: "4px"
`;
    const config = loadThemeConfig(yaml);
    expect(config.typography["h1"]?.fontSize).toBe("48px");
    expect(config.typography["h1"]?.fontWeight).toBe(600);
    expect(config.typography["h1"]?.lineHeight).toBe(1.1);
  });

  test("accepts unitless lineHeight", () => {
    const yaml = `
name: Test
colors:
  accent: "#000"
typography:
  body:
    fontFamily: "Arial, sans-serif"
    lineHeight: 1.6
rounded:
  sm: "4px"
`;
    const config = loadThemeConfig(yaml);
    expect(config.typography["body"]?.lineHeight).toBe(1.6);
  });
});

// ─── Rounded validation ───

describe("Theme rounded values", () => {
  test("rejects invalid length", () => {
    const yaml = `
name: Bad
colors:
  accent: "#000"
typography:
  body:
    fontFamily: "Arial, sans-serif"
rounded:
  sm: "big"
`;
    expect(() => loadThemeConfig(yaml, "bad.yaml")).toThrow("Theme validation failed");
  });

  test("accepts px and rem values", () => {
    const yaml = `
name: Test
colors:
  accent: "#000"
typography:
  body:
    fontFamily: "Arial, sans-serif"
rounded:
  sm: "8px"
  lg: "1.5rem"
`;
    const config = loadThemeConfig(yaml);
    expect(config.rounded["sm"]).toBe("8px");
    expect(config.rounded["lg"]).toBe("1.5rem");
  });
});

// ─── Spacing validation ───

describe("Theme spacing values", () => {
  test("accepts spacing map", () => {
    const yaml = `
name: Test
colors:
  accent: "#000"
typography:
  body:
    fontFamily: "Arial, sans-serif"
rounded:
  sm: "4px"
spacing:
  xs: 4px
  md: 16px
  lg: 32px
`;
    const config = loadThemeConfig(yaml);
    expect(config.spacing?.["md"]).toBe("16px");
  });

  test("spacing is optional", () => {
    const yaml = `
name: Test
colors:
  accent: "#000"
typography:
  body:
    fontFamily: "Arial, sans-serif"
rounded:
  sm: "4px"
`;
    const config = loadThemeConfig(yaml);
    expect(config.spacing).toBeUndefined();
  });
});

// ─── Components validation ───

describe("Theme components values", () => {
  test("accepts components map", () => {
    const yaml = `
name: Test
colors:
  accent: "#000"
typography:
  body:
    fontFamily: "Arial, sans-serif"
rounded:
  sm: "4px"
components:
  button-primary:
    padding: "12px 28px"
    fontSize: "16px"
`;
    const config = loadThemeConfig(yaml);
    expect(config.components?.["button-primary"]?.["padding"]).toBe("12px 28px");
  });

  test("components is optional", () => {
    const yaml = `
name: Test
colors:
  accent: "#000"
typography:
  body:
    fontFamily: "Arial, sans-serif"
rounded:
  sm: "4px"
`;
    const config = loadThemeConfig(yaml);
    expect(config.components).toBeUndefined();
  });
});

// ─── Missing fields ───

describe("Theme missing fields", () => {
  test("rejects missing name", () => {
    const yaml = `
colors:
  accent: "#000"
typography:
  body:
    fontFamily: "Arial, sans-serif"
rounded:
  sm: "4px"
`;
    expect(() => loadThemeConfig(yaml)).toThrow();
  });

  test("rejects missing colors", () => {
    const yaml = `
name: Test
typography:
  body:
    fontFamily: "Arial, sans-serif"
rounded:
  sm: "4px"
`;
    expect(() => loadThemeConfig(yaml)).toThrow();
  });

  test("rejects missing typography", () => {
    const yaml = `
name: Test
colors:
  accent: "#000"
rounded:
  sm: "4px"
`;
    expect(() => loadThemeConfig(yaml)).toThrow();
  });

  test("rejects missing rounded", () => {
    const yaml = `
name: Test
colors:
  accent: "#000"
typography:
  body:
    fontFamily: "Arial, sans-serif"
`;
    expect(() => loadThemeConfig(yaml)).toThrow();
  });
});

// ─── CSS generation ───

describe("generateThemeBlock", () => {
  test("generates correct @theme block from config", () => {
    const yaml = `
name: Test
colors:
  bg:
    primary: "#000"
  accent: "#0071e3"
typography:
  display:
    fontFamily: '"SF Pro", sans-serif'
  hero-title:
    fontSize: 42px
    fontWeight: 500
    lineHeight: 1.2
rounded:
  md: "8px"
spacing:
  md: 16px
components:
  button-primary:
    padding: "12px 28px"
    fontSize: "16px"
`;
    const config = loadThemeConfig(yaml);
    const block = generateThemeBlock(config);

    expect(block).toContain("@theme {");
    expect(block).toContain("--color-bg-primary: #000;");
    expect(block).toContain("--color-accent: #0071e3;");
    expect(block).toContain('--font-display: "SF Pro", sans-serif;');
    expect(block).toContain("--font-hero-title-size: 42px;");
    expect(block).toContain("--font-hero-title-weight: 500;");
    expect(block).toContain("--font-hero-title-line-height: 1.2;");
    expect(block).toContain("--radius-md: 8px;");
    expect(block).toContain("--spacing-md: 16px;");
    expect(block).toContain("--component-button-primary-padding: 12px 28px;");
    expect(block).toContain("--component-button-primary-font-size: 16px;");
    expect(block).toContain("}");
  });
});

// ─── toPx unit conversion (1 unit = 4px, Tailwind convention) ───

describe("toPx — Tailwind unit conversion", () => {
  test("integer units convert to px (1 unit = 4px)", () => {
    expect(toPx(1)).toBe("4px");
    expect(toPx(2)).toBe("8px");
    expect(toPx(4)).toBe("16px");
    expect(toPx(8)).toBe("32px");
    expect(toPx(16)).toBe("64px");
  });

  test("fractional units convert correctly", () => {
    expect(toPx(0.5)).toBe("2px");
    expect(toPx(1.5)).toBe("6px");
    expect(toPx(2.5)).toBe("10px");
  });

  test("zero converts to 0px", () => {
    expect(toPx(0)).toBe("0px");
  });

  test("string with unit passes through unchanged", () => {
    expect(toPx("16px")).toBe("16px");
    expect(toPx("1rem")).toBe("1rem");
    expect(toPx("50%")).toBe("50%");
    expect(toPx("0.5em")).toBe("0.5em");
  });
});

// ─── Numeric scale in spacing and rounded ───

describe("Numeric scale: spacing", () => {
  test("numeric spacing values convert via toPx in generated CSS", () => {
    const yaml = `
name: Test
colors:
  accent: "#000"
typography:
  body:
    fontFamily: "Arial, sans-serif"
rounded:
  sm: "4px"
spacing:
  xs: 1
  sm: 2
  md: 4
  lg: 8
  xl: 16
`;
    const config = loadThemeConfig(yaml);
    const block = generateThemeBlock(config);

    expect(block).toContain("--spacing-xs: 4px;");
    expect(block).toContain("--spacing-sm: 8px;");
    expect(block).toContain("--spacing-md: 16px;");
    expect(block).toContain("--spacing-lg: 32px;");
    expect(block).toContain("--spacing-xl: 64px;");
  });

  test("string spacing values pass through unchanged", () => {
    const yaml = `
name: Test
colors:
  accent: "#000"
typography:
  body:
    fontFamily: "Arial, sans-serif"
rounded:
  sm: "4px"
spacing:
  base: 16px
  gutter: 1.5rem
`;
    const config = loadThemeConfig(yaml);
    const block = generateThemeBlock(config);

    expect(block).toContain("--spacing-base: 16px;");
    expect(block).toContain("--spacing-gutter: 1.5rem;");
  });

  test("mixed numeric and string spacing accepted", () => {
    const yaml = `
name: Test
colors:
  accent: "#000"
typography:
  body:
    fontFamily: "Arial, sans-serif"
rounded:
  sm: "4px"
spacing:
  sm: 2
  base: 16px
`;
    const config = loadThemeConfig(yaml);
    expect(config.spacing?.["sm"]).toBe(2);
    expect(config.spacing?.["base"]).toBe("16px");
    const block = generateThemeBlock(config);
    expect(block).toContain("--spacing-sm: 8px;");
    expect(block).toContain("--spacing-base: 16px;");
  });
});

// ─── Color mode pairs ───

describe("Color mode pairs — schema validation", () => {
  test("accepts { light, dark } pair as a top-level color", () => {
    const yaml = `
name: Test
colors:
  surface:
    light: "#ffffff"
    dark: "#1b1a18"
typography:
  body:
    fontFamily: "Arial, sans-serif"
rounded:
  sm: "4px"
`;
    const config = loadThemeConfig(yaml);
    const surface = config.colors["surface"] as { light: string; dark: string };
    expect(surface.light).toBe("#ffffff");
    expect(surface.dark).toBe("#1b1a18");
  });

  test("accepts { light, dark } pair nested inside a color group", () => {
    const yaml = `
name: Test
colors:
  bg:
    primary:
      light: "#ffffff"
      dark: "#000000"
typography:
  body:
    fontFamily: "Arial, sans-serif"
rounded:
  sm: "4px"
`;
    const config = loadThemeConfig(yaml);
    const bg = config.colors["bg"] as Record<string, unknown>;
    const primary = bg["primary"] as { light: string; dark: string };
    expect(primary.light).toBe("#ffffff");
    expect(primary.dark).toBe("#000000");
  });

  test("rejects mode pair with invalid color value", () => {
    const yaml = `
name: Bad
colors:
  surface:
    light: "not-a-color"
    dark: "#000000"
typography:
  body:
    fontFamily: "Arial, sans-serif"
rounded:
  sm: "4px"
`;
    expect(() => loadThemeConfig(yaml, "bad.yaml")).toThrow("Theme validation failed");
  });

  test("mode pair dark value appears in @theme block", () => {
    const yaml = `
name: Test
colors:
  surface:
    light: "#ffffff"
    dark: "#1b1a18"
typography:
  body:
    fontFamily: "Arial, sans-serif"
rounded:
  sm: "4px"
`;
    const config = loadThemeConfig(yaml);
    const block = generateThemeBlock(config);
    expect(block).toContain("--color-surface: #1b1a18;");
    expect(block).not.toContain("--color-surface: #ffffff;");
  });
});

// ─── generateColorModeOverrides ───

describe("generateColorModeOverrides", () => {
  test("returns null when no mode pairs defined", () => {
    const yaml = `
name: Test
colors:
  accent: "#0071e3"
typography:
  body:
    fontFamily: "Arial, sans-serif"
rounded:
  sm: "4px"
`;
    const config = loadThemeConfig(yaml);
    expect(generateColorModeOverrides(config)).toBeNull();
  });

  test("emits light mode media query and data-theme selector", () => {
    const yaml = `
name: Test
colors:
  surface:
    light: "#ffffff"
    dark: "#1b1a18"
typography:
  body:
    fontFamily: "Arial, sans-serif"
rounded:
  sm: "4px"
`;
    const config = loadThemeConfig(yaml);
    const overrides = generateColorModeOverrides(config);
    expect(overrides).not.toBeNull();
    expect(overrides).toContain("@media (prefers-color-scheme: light)");
    expect(overrides).toContain('[data-theme="light"]');
    expect(overrides).toContain("--color-surface: #ffffff;");
  });

  test("nested mode pair emits correct var name", () => {
    const yaml = `
name: Test
colors:
  bg:
    primary:
      light: "#ffffff"
      dark: "#000000"
typography:
  body:
    fontFamily: "Arial, sans-serif"
rounded:
  sm: "4px"
`;
    const config = loadThemeConfig(yaml);
    const overrides = generateColorModeOverrides(config);
    expect(overrides).toContain("--color-bg-primary: #ffffff;");
  });

  test("static colors are not included in overrides", () => {
    const yaml = `
name: Test
colors:
  accent: "#0071e3"
  surface:
    light: "#ffffff"
    dark: "#000000"
typography:
  body:
    fontFamily: "Arial, sans-serif"
rounded:
  sm: "4px"
`;
    const config = loadThemeConfig(yaml);
    const overrides = generateColorModeOverrides(config);
    expect(overrides).not.toContain("--color-accent");
    expect(overrides).toContain("--color-surface: #ffffff;");
  });

  test("all themes have mode pairs after YAML updates", async () => {
    for (const name of ["apple", "google", "ferrari"]) {
      const yaml = await Bun.file(resolve(THEMES_DIR, `${name}.yaml`)).text();
      const config = loadThemeConfig(yaml, `${name}.yaml`);
      const overrides = generateColorModeOverrides(config);
      expect(overrides).not.toBeNull();
      expect(overrides).toContain("@media (prefers-color-scheme: light)");
    }
  });
});

describe("Numeric scale: rounded", () => {
  test("numeric rounded values convert via toPx in generated CSS", () => {
    const yaml = `
name: Test
colors:
  accent: "#000"
typography:
  body:
    fontFamily: "Arial, sans-serif"
rounded:
  sm: 1
  md: 2
  lg: 4
`;
    const config = loadThemeConfig(yaml);
    const block = generateThemeBlock(config);

    expect(block).toContain("--radius-sm: 4px;");
    expect(block).toContain("--radius-md: 8px;");
    expect(block).toContain("--radius-lg: 16px;");
  });

  test("string rounded values pass through unchanged", () => {
    const yaml = `
name: Test
colors:
  accent: "#000"
typography:
  body:
    fontFamily: "Arial, sans-serif"
rounded:
  sm: "5px"
  pill: "9999px"
`;
    const config = loadThemeConfig(yaml);
    const block = generateThemeBlock(config);

    expect(block).toContain("--radius-sm: 5px;");
    expect(block).toContain("--radius-pill: 9999px;");
  });
});

// ─── All themes use Tailwind numeric spacing ───

describe("All themes: Tailwind spacing scale", () => {
  test.each(["apple", "google", "ferrari"])("%s.yaml has spacing with numeric values", async (name) => {
    const yaml = await Bun.file(resolve(THEMES_DIR, `${name}.yaml`)).text();
    const config = loadThemeConfig(yaml, `${name}.yaml`);

    expect(config.spacing).toBeDefined();
    expect(Object.keys(config.spacing!).length).toBeGreaterThan(0);

    // All numeric spacing values should be positive
    for (const [key, value] of Object.entries(config.spacing!)) {
      if (typeof value === "number") {
        expect(value).toBeGreaterThan(0);
      }
    }
  });

  test.each(["apple", "google", "ferrari"])("%s.yaml spacing generates correct px values in @theme", async (name) => {
    const yaml = await Bun.file(resolve(THEMES_DIR, `${name}.yaml`)).text();
    const config = loadThemeConfig(yaml, `${name}.yaml`);
    const block = generateThemeBlock(config);

    // md: 4 → --spacing-md: 16px
    expect(block).toContain("--spacing-md: 16px;");
    // lg: 8 → --spacing-lg: 32px
    expect(block).toContain("--spacing-lg: 32px;");
  });
});
