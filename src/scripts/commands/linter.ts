import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import type { CLICommand } from "modality-cli-kit";
import { lintTheme, type Finding } from "../../lib/lint";
import { THEMES_DIR } from "../../config/const";

const LinterArgsSchema = z.object({
  theme: z
    .string()
    .optional()
    .describe("Theme name (e.g. apple) or path to a .yaml file. Omit to lint every theme in data/themes"),
});

type LinterArgs = z.infer<typeof LinterArgsSchema>;

async function resolveTargets(theme?: string): Promise<{ name: string; path: string }[]> {
  if (theme) {
    const path = theme.endsWith(".yaml") ? resolve(theme) : join(THEMES_DIR, `${theme}.yaml`);
    return [{ name: theme, path }];
  }
  const files = (await readdir(THEMES_DIR)).filter((f) => f.endsWith(".yaml"));
  return files.map((f) => ({ name: f.replace(".yaml", ""), path: join(THEMES_DIR, f) }));
}

function formatFinding(f: Finding): string {
  return `  ${f.severity.toUpperCase().padEnd(7)} ${f.path || "(root)"}: ${f.message}`;
}

async function linter(args: LinterArgs) {
  const targets = await resolveTargets(args.theme);
  if (targets.length === 0) {
    return { success: false, message: "No theme YAML files found in data/themes/" };
  }

  const lines: string[] = [];
  let totalErrors = 0;

  for (const { name, path } of targets) {
    const file = Bun.file(path);
    if (!(await file.exists())) {
      lines.push(`✗ ${name}: file not found at ${path}`);
      totalErrors++;
      continue;
    }
    const { findings, summary } = lintTheme(await file.text());
    totalErrors += summary.errors;
    const mark = summary.errors > 0 ? "✗" : "✓";
    lines.push(`${mark} ${name}: ${summary.errors} error(s), ${summary.warnings} warning(s), ${summary.infos} info`);
    lines.push(...findings.map(formatFinding));
  }

  return { success: totalErrors === 0, message: lines.join("\n") };
}

export const linterCommand: CLICommand = {
  name: "linter",
  aliases: ["lint"],
  description: "Lint DTCG theme YAML files: schema errors plus hex/components consistency checks",
  inputSchema: LinterArgsSchema,
  positionalKeys: ["theme"],
  execute: linter,
  examples: ["use-design linter", "use-design linter apple"],
};
