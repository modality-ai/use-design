import { describe, expect, test } from "bun:test";
import { auditTheme, contrastRatio, deltaE76, simulateCvd } from "../audit";
import type { ThemeConfig } from "../schema";

const color = (hex: string) => ({
  $value: { colorSpace: "srgb" as const, components: [0, 0, 0] as [number, number, number], hex },
});

function theme(root: Record<string, unknown>): ThemeConfig {
  return { name: "Test", root };
}

describe("color math", () => {
  test("contrast of black on white is 21:1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  test("contrast of identical colors is 1:1", () => {
    expect(contrastRatio("#ebe9e5", "#ebe9e5")).toBe(1);
  });

  test("deltaE of identical colors is 0", () => {
    expect(deltaE76("#819ebb", "#819ebb")).toBe(0);
  });

  test("CVD simulation returns a hex color", () => {
    expect(simulateCvd("#819ebb", "deuteranopia")).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("auditTheme", () => {
  test("passes contrast for black text on white paper", () => {
    const result = auditTheme(
      theme({
        color: {
          $type: "color",
          paper: color("#ffffff"),
          text: { primary: color("#000000") },
        },
      }),
      { rules: ["contrast"] }
    );
    expect(result.summary.errors).toBe(0);
  });

  test("flags low-contrast text as an error", () => {
    const result = auditTheme(
      theme({
        color: {
          $type: "color",
          paper: color("#ffffff"),
          text: { faint: color("#eeeeee") },
        },
      }),
      { rules: ["contrast"] }
    );
    expect(result.summary.errors).toBeGreaterThan(0);
    expect(result.findings.some((f) => f.rule === "contrast" && f.severity === "error")).toBe(true);
  });

  test("flags near-identical palette colors", () => {
    const result = auditTheme(
      theme({
        color: {
          $type: "color",
          island: { a: color("#ff0000"), b: color("#ff0101") },
        },
      }),
      { rules: ["palette"], group: "color.island" }
    );
    expect(result.summary.warnings).toBeGreaterThan(0);
  });

  test("flags a spacing value that is not a multiple of 2px", () => {
    const result = auditTheme(
      theme({
        spacing: {
          $type: "dimension",
          odd: { $value: { value: 5, unit: "px" } },
        },
      }),
      { rules: ["spacing"] }
    );
    expect(result.findings.some((f) => f.rule === "spacing" && f.severity === "warning")).toBe(true);
  });

  test("reports alias depth", () => {
    const result = auditTheme(
      theme({
        color: {
          $type: "color",
          base: color("#112233"),
          alias: { $value: "{color.base}" },
        },
      }),
      { rules: ["alias"] }
    );
    expect(result.findings.some((f) => f.rule === "alias" && f.severity === "info")).toBe(true);
  });
});
