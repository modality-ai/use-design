import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import type { CLICommand } from "modality-cli-kit";
import { loadThemeConfig } from "../../lib/generate";
import { auditTheme, ALL_RULES, type AuditFinding, type AuditRule } from "../../lib/audit";
import { THEMES_DIR } from "../../config/const";

const AuditArgsSchema = z.object({
  theme: z
    .string()
    .optional()
    .describe("Theme name (e.g. island) or path to a .yaml file. Omit to audit every theme in data/themes"),
  rules: z
    .string()
    .optional()
    .describe("Comma-separated rules: contrast, palette, alias, spacing (default: all)"),
  min: z
    .number()
    .optional()
    .describe("Minimum contrast ratio for text-on-surface pairs (default 4.5)"),
  group: z
    .string()
    .optional()
    .describe("Color group treated as a categorical palette (default color.island)"),
});

type AuditArgs = z.infer<typeof AuditArgsSchema>;

async function resolveTargets(theme?: string): Promise<{ name: string; path: string }[]> {
  if (theme) {
    const path = theme.endsWith(".yaml") ? resolve(theme) : join(THEMES_DIR, `${theme}.yaml`);
    return [{ name: theme, path }];
  }
  const files = (await readdir(THEMES_DIR)).filter((f) => f.endsWith(".yaml"));
  return files.map((f) => ({ name: f.replace(".yaml", ""), path: join(THEMES_DIR, f) }));
}

function parseRules(raw?: string): AuditRule[] | string {
  if (!raw) return ALL_RULES;
  const requested = raw
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
  const unknown = requested.filter((r) => !ALL_RULES.includes(r as AuditRule));
  if (unknown.length > 0) {
    return `Unknown rule(s): ${unknown.join(", ")}. Valid: ${ALL_RULES.join(", ")}`;
  }
  return requested as AuditRule[];
}

function formatFinding(f: AuditFinding): string {
  return `  ${f.severity.toUpperCase().padEnd(7)} [${f.rule}] ${f.path || "(root)"}: ${f.message}`;
}

async function audit(args: AuditArgs) {
  const targets = await resolveTargets(args.theme);
  if (targets.length === 0) {
    return { success: false, message: "No theme YAML files found in data/themes/" };
  }

  const rules = parseRules(args.rules);
  if (typeof rules === "string") return { success: false, message: rules };

  const lines: string[] = [];
  let totalErrors = 0;

  for (const { name, path } of targets) {
    const file = Bun.file(path);
    if (!(await file.exists())) {
      lines.push(`✗ ${name}: file not found at ${path}`);
      totalErrors++;
      continue;
    }

    let config;
    try {
      config = loadThemeConfig(await file.text(), path);
    } catch (err) {
      lines.push(`✗ ${name}: ${(err as Error).message}`);
      totalErrors++;
      continue;
    }

    const { findings, summary } = auditTheme(config, {
      rules,
      minContrast: args.min,
      group: args.group,
    });
    totalErrors += summary.errors;
    const mark = summary.errors > 0 ? "✗" : "✓";
    lines.push(
      `${mark} ${name}: ${summary.errors} error(s), ${summary.warnings} warning(s), ${summary.infos} info`
    );
    lines.push(...findings.map(formatFinding));
  }

  return { success: totalErrors === 0, message: lines.join("\n") };
}

export const auditCommand: CLICommand = {
  name: "audit",
  aliases: [],
  description:
    "Audit token relationships: WCAG contrast, categorical palette separation, alias depth, dimension rules",
  inputSchema: AuditArgsSchema,
  positionalKeys: ["theme"],
  execute: audit,
  examples: [
    "use-design audit island",
    "use-design audit island --rules contrast,palette",
    "use-design audit island --min 7 --group color.island",
    "use-design audit",
  ],
};
