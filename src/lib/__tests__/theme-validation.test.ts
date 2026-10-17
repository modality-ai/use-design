import { describe, test, expect } from "bun:test";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { stringify } from "yaml";
import { loadThemeConfig, generateThemeBlock, generateColorModeOverrides, buildThemeCss } from "../generate";
import { THEMES_DIR } from "../../config/const";

// ─── Helpers ───

const c = (hex: string, alpha?: number) => {
  const comps = [1, 3, 5].map((i) => Math.round((parseInt(hex.slice(i, i + 2), 16) / 255) * 1000) / 1000);
  return { colorSpace: "srgb", components: comps, ...(alpha === undefined ? {} : { alpha }), hex };
};
const px = (value: number) => ({ value, unit: "px" });

/** A minimal valid DTCG theme; override any top-level key. */
function theme(over: Record<string, unknown> = {}): string {
  return stringify({
    $description: "Test theme",
    $extensions: { "use-design.theme": { name: "Test", version: "alpha" } },
    color: { $type: "color", accent: { $value: c("#0071e3") } },
    font: { $type: "typography", body: { $value: { fontFamily: "Arial, sans-serif" } } },
    radius: { $type: "dimension", sm: { $value: px(4) } },
    ...over,
  });
}

async function themeFiles(): Promise<{ name: string; path: string }[]> {
  const files = await readdir(THEMES_DIR);
  return files
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => ({ name: f.replace(".yaml", ""), path: resolve(THEMES_DIR, f) }));
}

// ─── Shipped themes ───

describe("Shipped themes", () => {
  test("at least one theme exists", async () => {
    expect((await themeFiles()).length).toBeGreaterThan(0);
  });

  test("every theme passes the DTCG schema and has mode pairs", async () => {
    for (const t of await themeFiles()) {
      const config = loadThemeConfig(await Bun.file(t.path).text(), t.path);
      expect(config.name).toBeTruthy();
      expect(generateColorModeOverrides(config)).toContain("@media (prefers-color-scheme: light)");
    }
  });

  test.each(["apple", "google", "ferrari"])("%s spacing is on the Tailwind scale", async (name) => {
    const config = loadThemeConfig(await Bun.file(resolve(THEMES_DIR, `${name}.yaml`)).text());
    const block = generateThemeBlock(config);
    expect(block).toContain("--spacing-md: 16px;");
    expect(block).toContain("--spacing-lg: 32px;");
  });
});

// ─── Metadata and structure ───

describe("Theme metadata and structure", () => {
  test("reads name, version and description from root", () => {
    const config = loadThemeConfig(theme());
    expect(config.name).toBe("Test");
    expect(config.version).toBe("alpha");
    expect(config.description).toBe("Test theme");
  });

  test("rejects missing theme name", () => {
    expect(() => loadThemeConfig(theme({ $extensions: {} }))).toThrow("Theme name is required");
  });

  test.each(["color", "font", "radius"])("rejects missing %s group", (group) => {
    expect(() => loadThemeConfig(theme({ [group]: undefined }))).toThrow(`"${group}"`);
  });

  test("rejects names containing a period or braces", () => {
    const bad = theme({ color: { $type: "color", "a{b}": { $value: c("#000000") } } });
    expect(() => loadThemeConfig(bad)).toThrow("must not contain");
  });

  test("rejects a token with no $type", () => {
    const bad = theme({ color: { accent: { $value: c("#000000") } } });
    expect(() => loadThemeConfig(bad)).toThrow("no $type");
  });

  test("rejects an unknown $type", () => {
    const bad = theme({ color: { $type: "wobble", accent: { $value: 1 } } });
    expect(() => loadThemeConfig(bad)).toThrow("Unknown $type");
  });
});

// ─── Colors ───

describe("Colors", () => {
  test("rejects a CSS string where a color object is required", () => {
    const bad = theme({ color: { $type: "color", accent: { $value: "#0071e3" } } });
    expect(() => loadThemeConfig(bad, "bad.yaml")).toThrow("Theme validation failed");
  });

  test("rejects a bad hex", () => {
    const bad = theme({ color: { $type: "color", accent: { $value: { ...c("#000000"), hex: "nope" } } } });
    expect(() => loadThemeConfig(bad)).toThrow("hex must be");
  });

  test("opaque color emits hex; alpha color emits rgb()", () => {
    const config = loadThemeConfig(
      theme({
        color: {
          $type: "color",
          bg: { primary: { $value: c("#000000") } },
          shadow: { $value: c("#000000", 0.5) },
        },
      })
    );
    const block = generateThemeBlock(config);
    expect(block).toContain("--color-bg-primary: #000000;");
    expect(block).toContain("--color-shadow: rgb(0 0 0 / 0.5);");
  });

  test("alias resolves to the referenced color", () => {
    const config = loadThemeConfig(
      theme({
        color: { $type: "color", accent: { $value: c("#0071e3") }, link: { $value: "{color.accent}" } },
      })
    );
    expect(generateThemeBlock(config)).toContain("--color-link: #0071e3;");
  });

  test("rejects an alias that does not resolve", () => {
    const bad = theme({ color: { $type: "color", link: { $value: "{color.missing}" } } });
    expect(() => loadThemeConfig(bad)).toThrow("does not resolve");
  });

  test("rejects an alias cycle", () => {
    const bad = theme({
      color: { $type: "color", a: { $value: "{color.b}" }, b: { $value: "{color.a}" } },
    });
    expect(() => loadThemeConfig(bad)).toThrow("does not resolve");
  });
});

// ─── Light / dark mode ───

describe("Color mode pairs (use-design.mode)", () => {
  const surface = {
    $value: c("#ffffff"),
    $extensions: { "use-design.mode": { dark: c("#1b1a18") } },
  };

  test("dark value goes in @theme, light value in overrides", () => {
    const config = loadThemeConfig(theme({ color: { $type: "color", surface } }));
    const block = generateThemeBlock(config);
    expect(block).toContain("--color-surface: #1b1a18;");
    expect(block).not.toContain("--color-surface: #ffffff;");
    const overrides = generateColorModeOverrides(config);
    expect(overrides).toContain("@media (prefers-color-scheme: light)");
    expect(overrides).toContain('[data-theme="light"]');
    expect(overrides).toContain("--color-surface: #ffffff;");
  });

  test("nested mode token emits the full variable name", () => {
    const config = loadThemeConfig(theme({ color: { $type: "color", bg: { primary: surface } } }));
    expect(generateColorModeOverrides(config)).toContain("--color-bg-primary: #ffffff;");
  });

  test("returns null with no mode pairs; statics are excluded", () => {
    expect(generateColorModeOverrides(loadThemeConfig(theme()))).toBeNull();
    const config = loadThemeConfig(
      theme({ color: { $type: "color", accent: { $value: c("#0071e3") }, surface } })
    );
    expect(generateColorModeOverrides(config)).not.toContain("--color-accent");
  });

  test("rejects an invalid dark color", () => {
    const bad = theme({
      color: {
        $type: "color",
        surface: { $value: c("#ffffff"), $extensions: { "use-design.mode": { dark: "black" } } },
      },
    });
    expect(() => loadThemeConfig(bad)).toThrow("needs a valid color");
  });
});

// ─── Typography ───

describe("Typography", () => {
  test("composite token emits one variable per field", () => {
    const config = loadThemeConfig(
      theme({
        font: {
          $type: "typography",
          "hero-title": {
            $value: {
              fontFamily: ["FerrariSans", "Arial"],
              fontSize: px(42),
              fontWeight: 500,
              lineHeight: 1.2,
              letterSpacing: px(1.28),
            },
            $extensions: { "use-design.font": { feature: '"ss01"' } },
          },
        },
      })
    );
    const block = generateThemeBlock(config);
    expect(block).toContain("--font-hero-title: FerrariSans, Arial;");
    expect(block).toContain("--font-hero-title-size: 42px;");
    expect(block).toContain("--font-hero-title-weight: 500;");
    expect(block).toContain("--font-hero-title-line-height: 1.2;");
    expect(block).toContain("--font-hero-title-letter-spacing: 1.28px;");
    expect(block).toContain('--font-hero-title-feature: "ss01";');
  });

  test("fontFamily-only token is accepted", () => {
    const config = loadThemeConfig(theme());
    expect(generateThemeBlock(config)).toContain("--font-body: Arial, sans-serif;");
  });

  test("rejects a CSS string for fontSize", () => {
    const bad = theme({
      font: { $type: "typography", h1: { $value: { fontSize: "48px" } } },
    });
    expect(() => loadThemeConfig(bad)).toThrow("Theme validation failed");
  });
});

// ─── Radius ───

describe("Radius", () => {
  test("off-scale radius is allowed", () => {
    const config = loadThemeConfig(
      theme({ radius: { $type: "dimension", sm: { $value: px(5) }, pill: { $value: px(980) } } })
    );
    const block = generateThemeBlock(config);
    expect(block).toContain("--radius-sm: 5px;");
    expect(block).toContain("--radius-pill: 980px;");
  });

  test("rem is allowed", () => {
    const config = loadThemeConfig(
      theme({ radius: { $type: "dimension", lg: { $value: { value: 1.5, unit: "rem" } } } })
    );
    expect(generateThemeBlock(config)).toContain("--radius-lg: 1.5rem;");
  });

  test("rejects a string radius value for a dimension", () => {
    const bad = theme({ radius: { $type: "dimension", sm: { $value: "big" } } });
    expect(() => loadThemeConfig(bad)).toThrow("Theme validation failed");
  });
});

// ─── Spacing: Tailwind scale (multiples of 2px) ───

describe("Spacing", () => {
  const spacing = (v: unknown) => theme({ spacing: { $type: "dimension", md: { $value: v } } });

  test("accepts whole and half Tailwind units", () => {
    for (const v of [2, 4, 6, 16, 80]) {
      const config = loadThemeConfig(spacing(px(v)));
      expect(generateThemeBlock(config)).toContain(`--spacing-md: ${v}px;`);
    }
  });

  test("rejects off-scale values", () => {
    for (const v of [3, 5, 17]) {
      expect(() => loadThemeConfig(spacing(px(v)))).toThrow("Tailwind scale");
    }
  });

  test("rejects rem spacing", () => {
    expect(() => loadThemeConfig(spacing({ value: 1, unit: "rem" }))).toThrow("Tailwind scale");
  });

  test("spacing is optional", () => {
    expect(generateThemeBlock(loadThemeConfig(theme()))).not.toContain("--spacing-");
  });
});

// ─── Components ───

describe("Components", () => {
  const component = {
    $type: "string",
    "button-primary": {
      padding: { $value: "12px 28px" },
      fontSize: { $type: "dimension", $value: px(16) },
    },
  };

  test("component tokens emit --component-* variables", () => {
    const block = generateThemeBlock(loadThemeConfig(theme({ component })));
    expect(block).toContain("--component-button-primary-padding: 12px 28px;");
    expect(block).toContain("--component-button-primary-font-size: 16px;");
  });

  test("component can alias a spacing token", () => {
    const config = loadThemeConfig(
      theme({
        spacing: { $type: "dimension", md: { $value: px(16) } },
        component: { "button-primary": { fontSize: { $type: "dimension", $value: "{spacing.md}" } } },
      })
    );
    expect(generateThemeBlock(config)).toContain("--component-button-primary-font-size: 16px;");
  });

  test("component group is optional", () => {
    expect(generateThemeBlock(loadThemeConfig(theme()))).not.toContain("--component-");
  });
});

// ─── Block shape ───

describe("generateThemeBlock", () => {
  test("wraps output in @theme static { }", () => {
    const block = generateThemeBlock(loadThemeConfig(theme()));
    expect(block.startsWith("@theme static {")).toBe(true);
    expect(block.endsWith("}")).toBe(true);
  });

  test("emits tokens no utility references (regression: Tailwind tree-shaking)", () => {
    const config = loadThemeConfig(theme({ spacing: { $type: "dimension", gutter: { $value: px(24) } } }));
    expect(generateThemeBlock(config)).toContain("--spacing-gutter: 24px;");
  });
});

// ─── use-design.css override ───

describe("Color CSS override (use-design.css)", () => {
  const overridden = (css: string) =>
    theme({
      color: {
        $type: "color",
        bg: { $value: c("#000000", 0), $extensions: { "use-design.css": css } },
      },
    });

  test("override replaces the generated color value", () => {
    const block = generateThemeBlock(loadThemeConfig(overridden("transparent")));
    expect(block).toContain("--color-bg: transparent;");
  });

  test("without override, alpha colors emit rgb(r g b / a)", () => {
    const config = loadThemeConfig(theme({ color: { $type: "color", bg: { $value: c("#000000", 0.5) } } }));
    expect(generateThemeBlock(config)).toContain("--color-bg: rgb(0 0 0 / 0.5);");
  });
});

// ─── Full CSS assembly ───

describe("buildThemeCss", () => {
  test("emits import, static theme block and component CSS", () => {
    const css = buildThemeCss(theme(), ".btn-primary { color: red; }");
    expect(css).toContain('@import "tailwindcss";');
    expect(css).toContain("@theme static {");
    expect(css).toContain(".btn-primary");
  });

  test("injects button-primary padding token into button rules", () => {
    const yaml = theme({
      component: { "button-primary": { padding: { $type: "string", $value: "12px 28px" } } },
    });
    const css = buildThemeCss(yaml, ".btn-primary { padding: 1px; }");
    expect(css).toContain("padding: var(--component-button-primary-padding);");
  });
});
