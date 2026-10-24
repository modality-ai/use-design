import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import type { CLICommand } from "modality-cli-kit";
import { loadThemeConfig } from "../../lib/generate";
import { exportTheme, type ExportFormat, type ExportMode } from "../../lib/export";
import { THEMES_DIR } from "../../config/const";

const TokensArgsSchema = z.object({
  theme: z
    .string()
    .optional()
    .describe("Theme name (e.g. island) or path to a .yaml file. Omit to export every theme in data/themes"),
  format: z
    .enum(["json", "ts", "css"])
    .optional()
    .describe("Output format: json (resolved tokens), ts (as-const object), css (custom properties)"),
  mode: z
    .enum(["light", "dark"])
    .optional()
    .describe("Emit a single mode. Omit to keep light/dark pairs"),
  out: z
    .string()
    .optional()
    .describe("Write to this path instead of stdout. Requires a single theme"),
});

type TokensArgs = z.infer<typeof TokensArgsSchema>;

async function resolveTargets(theme?: string): Promise<{ name: string; path: string }[]> {
  if (theme) {
    const path = theme.endsWith(".yaml") ? resolve(theme) : join(THEMES_DIR, `${theme}.yaml`);
    return [{ name: theme, path }];
  }
  const files = (await readdir(THEMES_DIR)).filter((f) => f.endsWith(".yaml"));
  return files.map((f) => ({ name: f.replace(".yaml", ""), path: join(THEMES_DIR, f) }));
}

async function tokens(args: TokensArgs) {
  const targets = await resolveTargets(args.theme);
  if (targets.length === 0) {
    return { success: false, message: "No theme YAML files found in data/themes/" };
  }

  const format: ExportFormat = args.format ?? "json";
  const mode = args.mode as ExportMode | undefined;

  if (args.out && targets.length > 1) {
    return {
      success: false,
      message: "--out requires a single theme; pass a theme name or a .yaml path",
    };
  }

  const outputs: string[] = [];

  for (const { name, path } of targets) {
    const file = Bun.file(path);
    if (!(await file.exists())) {
      return { success: false, message: `✗ ${name}: file not found at ${path}` };
    }

    let config;
    try {
      config = loadThemeConfig(await file.text(), path);
    } catch (err) {
      return { success: false, message: `✗ ${name}: ${(err as Error).message}` };
    }

    let output: string;
    try {
      output = exportTheme(config, format, mode);
    } catch (err) {
      return { success: false, message: `✗ ${name}: ${(err as Error).message}` };
    }

    if (args.out) {
      const outPath = resolve(args.out);
      await Bun.write(outPath, output);
      const count = (output.match(/^\s*"/gm) ?? []).length;
      return {
        success: true,
        message: `✓ ${config.name} → ${outPath} (${format}${mode ? `, ${mode}` : ""}, ${count} keys)`,
      };
    }

    outputs.push(outputs.length > 0 ? `\n# ── ${config.name} ──\n${output}` : output);
  }

  return { success: true, message: outputs.join("") };
}

export const tokensCommand: CLICommand = {
  name: "tokens",
  aliases: ["export-tokens"],
  description:
    "Export resolved theme tokens (aliases expanded, light/dark pairs) as json, ts or css",
  inputSchema: TokensArgsSchema,
  positionalKeys: ["theme"],
  execute: tokens,
  examples: [
    "use-design tokens island",
    "use-design tokens island --format ts --out src/generated/tokens.ts",
    "use-design tokens island --mode dark --format json",
    "use-design tokens",
  ],
};
