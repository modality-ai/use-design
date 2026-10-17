import { $ } from "bun";
import { readdir } from "node:fs/promises";
import { join } from "path";
import { buildThemeCss } from "./lib/theme-lib/generate";
import { THEMES_DIR } from "./const";

const srcDir = import.meta.dir;
const rootDir = join(srcDir, "..");

// Discover themes from YAML files
const themeDir = THEMES_DIR;
const themeFiles = (await readdir(themeDir)).filter((f) => f.endsWith(".yaml"));

if (themeFiles.length === 0) {
  console.error("No theme YAML files found in src/themes/");
  process.exit(1);
}

// Build client bundle
const result = await Bun.build({
  entrypoints: [join(srcDir, "web/index.tsx")],
  outdir: join(rootDir, "public/static"),
  naming: "client.js",
  minify: true,
  target: "browser",
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});

if (!result.success) {
  console.error("Client build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}
console.log("✓ Client bundle built");

// Generate and compile theme CSS files
for (const file of themeFiles) {
  const themeName = file.replace(".yaml", "");
  const yamlPath = join(themeDir, file);
  const componentPath = join(srcDir, `styles/components/${themeName}.css`);

  // Read YAML config
  const yamlContent = await Bun.file(yamlPath).text();

  // Read component CSS
  const componentFile = Bun.file(componentPath);
  if (!(await componentFile.exists())) {
    console.warn(`⚠ No component CSS for "${themeName}" at ${componentPath}, skipping`);
    continue;
  }
  const componentCss = await componentFile.text();

  // Validate YAML with Zod + generate combined CSS
  let combinedCss: string;
  try {
    combinedCss = buildThemeCss(yamlContent, componentCss, yamlPath);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  // Write intermediate CSS (pre-Tailwind compilation)
  const intermediatePath = join(srcDir, `styles/themes/${themeName}.css`);
  await Bun.write(intermediatePath, combinedCss);

  // Compile with TailwindCSS
  const outPath = join(rootDir, `public/styles/themes/${themeName}.css`);
  await $`bunx @tailwindcss/cli -i ${intermediatePath} -o ${outPath} --minify`.quiet();
  console.log(`✓ Theme "${themeName}" — YAML validated, CSS generated`);
}

console.log("\nBuild complete! Run: bun run dev");
