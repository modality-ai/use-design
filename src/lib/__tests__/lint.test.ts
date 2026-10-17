import { describe, test, expect } from "bun:test";
import { stringify } from "yaml";
import { lintTheme } from "../lint";

const c = (hex: string, over: Record<string, unknown> = {}) => {
  const comps = [1, 3, 5].map((i) => Math.round((parseInt(hex.slice(i, i + 2), 16) / 255) * 1000) / 1000);
  return { colorSpace: "srgb", components: comps, hex, ...over };
};

function theme(color: unknown, description: string | undefined = "Test"): string {
  return stringify({
    ...(description ? { $description: description } : {}),
    $extensions: { "use-design.theme": { name: "Test", version: "alpha" } },
    color: { $type: "color", accent: { $value: color } },
    font: { $type: "typography", body: { $value: { fontFamily: "Arial" } } },
    radius: { $type: "dimension", sm: { $value: { value: 4, unit: "px" } } },
  });
}

describe("lintTheme", () => {
  test("valid theme has no findings", () => {
    expect(lintTheme(theme(c("#0071e3"))).findings).toEqual([]);
  });

  test("invalid YAML is an error", () => {
    expect(lintTheme("a: [").summary.errors).toBe(1);
  });

  test("schema violation is reported as an error with its path", () => {
    const result = lintTheme(theme("red"));
    expect(result.findings.some((f) => f.severity === "error" && f.path.startsWith("color.accent"))).toBe(true);
  });

  test("hex that disagrees with components is a warning", () => {
    const result = lintTheme(theme(c("#0071e3", { hex: "#ff0000" })));
    expect(result.summary.warnings).toBe(1);
  });

  test("missing $description is an info", () => {
    expect(lintTheme(theme(c("#0071e3"), "")).summary.infos).toBe(1);
  });
});
