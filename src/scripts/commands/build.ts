import { $ } from "bun";
import { readdir } from "node:fs/promises";
import { join } from "path";
import { z } from "zod";
import type { CLICommand } from "modality-cli-kit";
import { buildThemeCss } from "../../lib/theme-lib/generate";
import { ROOT_DIR, THEMES_DIR } from "../../config/const";

const BuildArgsSchema = z.object({});

// Anchored to the project root, so it resolves correctly from src/ and dist/
const rootDir = ROOT_DIR;
const srcDir = join(rootDir, "src");

// Alias React imports to hono/jsx/dom for the browser bundle only
const reactAliases: Record<string, string> = {
  react: "hono/jsx/dom",
  "react/jsx-runtime": "hono/jsx/dom/jsx-runtime",
  "react/jsx-dev-runtime": "hono/jsx/dom/jsx-dev-runtime",
  "react-dom": "hono/jsx/dom",
  "react-dom/client": "hono/jsx/dom/client",
};
const reactToHono: Bun.BunPlugin = {
  name: "react-to-hono-jsx",
  setup(build) {
    build.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (args) => {
      const target = reactAliases[args.path];
      return target ? { path: Bun.resolveSync(target, rootDir) } : undefined;
    });
  },
};

async function build() {
  // Discover themes from YAML files
  const themeFiles = (await readdir(THEMES_DIR)).filter((f) => f.endsWith(".yaml"));
  if (themeFiles.length === 0) {
    return { success: false, message: "No theme YAML files found in src/themes/" };
  }

  // Build client bundle
  const result = await Bun.build({
    entrypoints: [join(srcDir, "web/index.tsx")],
    outdir: join(rootDir, "public/static"),
    naming: "client.js",
    minify: true,
    target: "browser",
    plugins: [reactToHono],
    define: { "process.env.NODE_ENV": '"production"' },
  });
  if (!result.success) {
    return {
      success: false,
      message: `Client build failed:\n${result.logs.map(String).join("\n")}`,
    };
  }

  const lines = ["✓ Client bundle built"];

  // Generate and compile theme CSS files
  for (const file of themeFiles) {
    const themeName = file.replace(".yaml", "");
    const yamlPath = join(THEMES_DIR, file);
    const componentPath = join(srcDir, `styles/components/${themeName}.css`);

    const yamlContent = await Bun.file(yamlPath).text();

    const componentFile = Bun.file(componentPath);
    if (!(await componentFile.exists())) {
      lines.push(`⚠ No component CSS for "${themeName}" at ${componentPath}, skipping`);
      continue;
    }
    const componentCss = await componentFile.text();

    // Validate YAML with Zod + generate combined CSS
    let combinedCss: string;
    try {
      combinedCss = buildThemeCss(yamlContent, componentCss, yamlPath);
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }

    // Write intermediate CSS (pre-Tailwind compilation)
    const intermediatePath = join(srcDir, `styles/themes/${themeName}.css`);
    await Bun.write(intermediatePath, combinedCss);

    // Compile with TailwindCSS
    const outPath = join(rootDir, `public/styles/themes/${themeName}.css`);
    await $`bunx @tailwindcss/cli -i ${intermediatePath} -o ${outPath} --minify`.quiet();
    lines.push(`✓ Theme "${themeName}" — YAML validated, CSS generated`);
  }

  lines.push("\nBuild complete! Run: bun run dev");
  return { success: true, message: lines.join("\n") };
}

export const buildCommand: CLICommand = {
  name: "build",
  aliases: [],
  description: "Build the web client bundle and compile theme CSS from YAML",
  inputSchema: BuildArgsSchema,
  positionalKeys: [],
  execute: build,
  examples: ["use-design build"],
};
