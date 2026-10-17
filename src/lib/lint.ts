import { parse as parseYaml } from "yaml";
import { themeSchema, walkTokens, aliasTarget, colorValue, MODE_EXT, type ColorValue } from "./schema";

export type Severity = "error" | "warning" | "info";
export type Finding = { severity: Severity; path: string; message: string };
export type LintResult = {
  findings: Finding[];
  summary: { errors: number; warnings: number; infos: number };
};

function toHex(c: ColorValue): string {
  const [r, g, b] = c.components.map((v) => Math.round(v * 255));
  return `#${[r, g, b].map((n) => n!.toString(16).padStart(2, "0")).join("")}`;
}

function summarize(findings: Finding[]): LintResult {
  const count = (s: Severity) => findings.filter((f) => f.severity === s).length;
  return {
    findings,
    summary: { errors: count("error"), warnings: count("warning"), infos: count("info") },
  };
}

/** Schema violations are errors; the rules below only run on a structurally valid theme. */
export function lintTheme(yamlContent: string): LintResult {
  let raw: unknown;
  try {
    raw = parseYaml(yamlContent);
  } catch (err) {
    return summarize([{ severity: "error", path: "", message: `Invalid YAML: ${(err as Error).message}` }]);
  }

  const parsed = themeSchema.safeParse(raw);
  if (!parsed.success) {
    return summarize(
      parsed.error.issues.map((i) => ({
        severity: "error" as const,
        path: i.path.join("."),
        message: i.message,
      }))
    );
  }

  const { root, description } = parsed.data;
  const findings: Finding[] = [];

  if (!description) {
    findings.push({ severity: "info", path: "$description", message: "Theme has no $description" });
  }

  for (const { path, token, type } of walkTokens(root)) {
    if (type !== "color" || aliasTarget(token.$value)) continue;
    const where = path.join(".");
    const candidates: [string, unknown][] = [
      [where, token.$value],
      [`${where}.$extensions.${MODE_EXT}.dark`, (token.$extensions?.[MODE_EXT] as any)?.dark],
    ];
    for (const [p, value] of candidates) {
      const color = colorValue.safeParse(value);
      if (color.success && toHex(color.data) !== color.data.hex.toLowerCase()) {
        findings.push({
          severity: "warning",
          path: p,
          message: `hex ${color.data.hex} does not match components (${toHex(color.data)})`,
        });
      }
    }
  }

  return summarize(findings);
}
