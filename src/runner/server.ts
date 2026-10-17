import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { readdirSync } from "fs";
import { join } from "path";

const THEMES_DIR = join(import.meta.dir, "../../data/themes");

// Synchronous FOUC-prevention: reads localStorage/OS pref before first paint.
// Must stay inline in <head> — do NOT move to an external script file.
const FOUC_SCRIPT = `<script>(function(){var m='dark';try{var s=localStorage.getItem('theme-mode');if(s==='light'||s==='dark')m=s;}catch(e){}if(m==='dark'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme:light)').matches){try{if(!localStorage.getItem('theme-mode'))m='light';}catch(e){m='light';}}document.documentElement.setAttribute('data-mode',m);if(m==='light')document.documentElement.setAttribute('data-theme','light');})()</script>`;

function page(title: string, theme: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  ${FOUC_SCRIPT}
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <link id="theme-css" rel="stylesheet" href="/styles/themes/${theme}.css" />
</head>
<body style="margin:0">
  <div id="root"></div>
  <script type="module" src="/static/client.js"></script>
</body>
</html>`;
}

const app = new Hono();

// Serve built static assets
app.use("/static/*", serveStatic({ root: "./public/" }));
app.use("/styles/*", serveStatic({ root: "./public/" }));

// Themes API
app.get("/api/themes", (c) => {
  const themes = readdirSync(THEMES_DIR)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => f.replace(".yaml", ""));
  return c.json(themes);
});

// Theme preview by path
app.get("/design-md/:theme/preview", (c) => {
  const theme = c.req.param("theme");
  const name = theme.charAt(0).toUpperCase() + theme.slice(1);
  return c.html(page(`Use Design — ${name} Design System`, theme));
});

// Main page
app.get("/", (c) => {
  const theme = c.req.query("theme") ?? "apple";
  return c.html(page("Use Design — Themeable Design System", theme));
});

export default {
  port: 3000,
  fetch: app.fetch,
};
