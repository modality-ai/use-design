import {
  walkTokens,
  aliasTarget,
  resolveToken,
  MODE_EXT,
  type ThemeConfig,
  type ColorValue,
  type TokenEntry,
} from "./schema";

/**
 * Cross-token checks that `linter` does not cover: `linter` validates a single
 * token (schema, hex/components agreement), `audit` validates relationships
 * between tokens (contrast, categorical separation, alias depth, dimensions).
 *
 * Findings are advisory; only `error` makes the command fail.
 */

export type AuditRule = "contrast" | "palette" | "alias" | "spacing";
export type Severity = "error" | "warning" | "info";

export type AuditFinding = {
  rule: AuditRule;
  severity: Severity;
  path: string;
  message: string;
};

export type AuditOptions = {
  rules?: AuditRule[];
  /** Minimum contrast for text-on-surface pairs (default 4.5). */
  minContrast?: number;
  /** Color group treated as a categorical palette (default `color.island`). */
  group?: string;
  /** Minimum CIE76 ΔE between any two palette colors (default 10). */
  minDeltaE?: number;
  /** Minimum ΔE after CVD simulation (default 6). */
  minCvdDeltaE?: number;
  /** Minimum hue distance between consecutive palette entries (default 15°). */
  minHueDiff?: number;
};

export type AuditResult = {
  findings: AuditFinding[];
  summary: { errors: number; warnings: number; infos: number };
};

export const ALL_RULES: AuditRule[] = ["contrast", "palette", "alias", "spacing"];

// ─── Color math ───────────────────────────────────────────────────────────────

type RGB = [number, number, number];

function parseHex(hex: string): RGB {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function encode(c: number): number {
  const v = Math.max(0, Math.min(1, c));
  return Math.round((v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055) * 255);
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(linearize) as RGB;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function rgbToLab(hex: string): [number, number, number] {
  const [r, g, b] = parseHex(hex).map(linearize) as RGB;
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function deltaE76(a: string, b: string): number {
  const la = rgbToLab(a);
  const lb = rgbToLab(b);
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}

/** Hue in degrees (0–360) from sRGB. */
export function hue(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => v / 255) as RGB;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

const CVD_MATRICES = {
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
} as const;

/** Linear-RGB simulation (Brettel-style matrices); approximate but stable. */
export function simulateCvd(hex: string, type: keyof typeof CVD_MATRICES): string {
  const m = CVD_MATRICES[type];
  const [r, g, b] = parseHex(hex).map(linearize) as RGB;
  const out: RGB = [
    m[0][0]! * r + m[0][1]! * g + m[0][2]! * b,
    m[1][0]! * r + m[1][1]! * g + m[1][2]! * b,
    m[2][0]! * r + m[2][1]! * g + m[2][2]! * b,
  ];
  return `#${out.map((c) => encode(c).toString(16).padStart(2, "0")).join("")}`;
}

// ─── Token access ─────────────────────────────────────────────────────────────

type FlatToken = {
  path: string;
  entry: TokenEntry;
  type?: string;
  light?: string;
  dark?: string;
};

function flatColors(config: ThemeConfig): FlatToken[] {
  const root = config.root;
  const out: FlatToken[] = [];

  for (const entry of walkTokens(root)) {
    if (entry.type !== "color") continue;
    const resolved = resolveToken(root, entry);
    if (!resolved) continue;

    const toHex = (value: unknown): string | undefined => {
      const v = value as ColorValue | undefined;
      if (!v || typeof v !== "object" || !("hex" in v)) return undefined;
      return v.hex.toLowerCase();
    };

    const mode = (entry.token.$extensions?.[MODE_EXT] ??
      resolved.token.$extensions?.[MODE_EXT]) as { dark?: ColorValue } | undefined;

    out.push({
      path: entry.path.join("."),
      entry,
      type: entry.type,
      light: toHex(resolved.token.$value),
      dark: toHex(mode?.dark),
    });
  }

  return out;
}

function isBg(path: string): boolean {
  return path === "color.paper" || path === "color.surface" || path.startsWith("color.bg.");
}

function isText(path: string): boolean {
  return path.startsWith("color.text.");
}

function isAccent(path: string): boolean {
  return path.startsWith("color.accent.");
}

// ─── Rules ────────────────────────────────────────────────────────────────────

function contrastRule(colors: FlatToken[], min: number): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const backgrounds = colors.filter((c) => isBg(c.path));
  const texts = colors.filter((c) => isText(c.path));
  const accents = colors.filter((c) => isAccent(c.path));
  let checked = 0;
  let worst = Number.POSITIVE_INFINITY;
  let worstPair = "";

  if (backgrounds.length === 0) {
    return [
      {
        rule: "contrast",
        severity: "info",
        path: "color",
        message: "No background tokens (color.paper / color.surface / color.bg.*); skipped",
      },
    ];
  }

  for (const bg of backgrounds) {
    for (const text of texts) {
      for (const mode of ["light", "dark"] as const) {
        const fg = text[mode];
        const back = bg[mode] ?? bg.light;
        if (!fg || !back) continue;
        const ratio = contrastRatio(fg, back);
        checked++;
        if (ratio < worst) {
          worst = ratio;
          worstPair = `${text.path} on ${bg.path} (${mode})`;
        }
        if (ratio < min) {
          findings.push({
            rule: "contrast",
            severity: "error",
            path: `${text.path} on ${bg.path} (${mode})`,
            message: `${ratio.toFixed(2)}:1 < ${min}:1`,
          });
        }
      }
    }

    for (const accent of accents) {
      for (const mode of ["light", "dark"] as const) {
        const fg = accent[mode];
        const back = bg[mode] ?? bg.light;
        if (!fg || !back) continue;
        const ratio = contrastRatio(fg, back);
        if (ratio < 3) {
          findings.push({
            rule: "contrast",
            severity: "warning",
            path: `${accent.path} on ${bg.path} (${mode})`,
            message: `${ratio.toFixed(2)}:1 < 3:1 (non-text graphic)`,
          });
        }
      }
    }
  }

  if (checked > 0) {
    findings.push({
      rule: "contrast",
      severity: "info",
      path: "color",
      message: `${checked} text pair(s) checked, lowest ${worst.toFixed(2)}:1 at ${worstPair}`,
    });
  }

  return findings;
}

function paletteRule(
  colors: FlatToken[],
  group: string,
  minDeltaE: number,
  minCvd: number,
  minHue: number
): AuditFinding[] {
  const palette = colors.filter((c) => c.path.startsWith(`${group}.`) && c.light);
  if (palette.length < 2) {
    return [
      {
        rule: "palette",
        severity: "info",
        path: group,
        message: `Found ${palette.length} colors; need at least 2 to compare`,
      },
    ];
  }

  const findings: AuditFinding[] = [];
  const pairs: { a: string; b: string; d: number }[] = [];

  for (let i = 0; i < palette.length; i++) {
    for (let j = i + 1; j < palette.length; j++) {
      const a = palette[i]!;
      const b = palette[j]!;
      pairs.push({ a: a.path, b: b.path, d: deltaE76(a.light!, b.light!) });
    }
  }

  const tooClose = pairs.filter((p) => p.d < minDeltaE).sort((x, y) => x.d - y.d);
  for (const p of tooClose.slice(0, 12)) {
    findings.push({
      rule: "palette",
      severity: "warning",
      path: `${p.a} ↔ ${p.b}`,
      message: `ΔE ${p.d.toFixed(1)} < ${minDeltaE} (too similar)`,
    });
  }
  if (tooClose.length > 12) {
    findings.push({
      rule: "palette",
      severity: "warning",
      path: group,
      message: `${tooClose.length - 12} more pair(s) below ΔE ${minDeltaE}`,
    });
  }

  for (const type of ["deuteranopia", "protanopia"] as const) {
    const cvdPairs = pairs
      .map((p) => {
        const a = simulateCvd(palette.find((c) => c.path === p.a)!.light!, type);
        const b = simulateCvd(palette.find((c) => c.path === p.b)!.light!, type);
        return { a: p.a, b: p.b, d: deltaE76(a, b) };
      })
      .filter((p) => p.d < minCvd)
      .sort((x, y) => x.d - y.d);

    for (const p of cvdPairs.slice(0, 6)) {
      findings.push({
        rule: "palette",
        severity: "warning",
        path: `${p.a} ↔ ${p.b}`,
        message: `ΔE ${p.d.toFixed(1)} under ${type} < ${minCvd}`,
      });
    }
    if (cvdPairs.length > 6) {
      findings.push({
        rule: "palette",
        severity: "warning",
        path: group,
        message: `${cvdPairs.length - 6} more ${type} pair(s) below ΔE ${minCvd}`,
      });
    }
  }

  for (let i = 1; i < palette.length; i++) {
    const prev = hue(palette[i - 1]!.light!);
    const cur = hue(palette[i]!.light!);
    const diff = Math.min(Math.abs(cur - prev), 360 - Math.abs(cur - prev));
    if (diff < minHue) {
      findings.push({
        rule: "palette",
        severity: "warning",
        path: `${palette[i - 1]!.path} → ${palette[i]!.path}`,
        message: `adjacent hue distance ${diff.toFixed(0)}° < ${minHue}°`,
      });
    }
  }

  const distances = pairs.map((p) => p.d);
  findings.push({
    rule: "palette",
    severity: "info",
    path: group,
    message: `${palette.length} colors, ΔE range ${Math.min(...distances).toFixed(1)}–${Math.max(
      ...distances
    ).toFixed(1)}, ${tooClose.length} pair(s) below ${minDeltaE}`,
  });

  return findings;
}

function aliasRule(config: ThemeConfig): AuditFinding[] {
  const root = config.root;
  const entries = walkTokens(root);
  const byPath = new Map(entries.map((e) => [e.path.join("."), e]));
  const findings: AuditFinding[] = [];
  let aliasCount = 0;
  let maxDepth = 0;

  for (const entry of entries) {
    if (!aliasTarget(entry.token.$value)) continue;
    aliasCount++;

    let current: TokenEntry | undefined = entry;
    let depth = 0;
    const seen = new Set<string>();

    while (current) {
      const target = aliasTarget(current.token.$value);
      if (!target) break;
      const key = target.join(".");
      if (seen.has(key)) {
        findings.push({
          rule: "alias",
          severity: "error",
          path: entry.path.join("."),
          message: `cyclic alias through ${key}`,
        });
        break;
      }
      seen.add(key);
      depth++;
      current = byPath.get(key);
      if (!current) {
        findings.push({
          rule: "alias",
          severity: "error",
          path: entry.path.join("."),
          message: `alias ${key} does not resolve`,
        });
        break;
      }
    }

    maxDepth = Math.max(maxDepth, depth);
    if (depth > 3) {
      findings.push({
        rule: "alias",
        severity: "warning",
        path: entry.path.join("."),
        message: `alias chain depth ${depth} > 3`,
      });
    }
  }

  findings.push({
    rule: "alias",
    severity: "info",
    path: "$",
    message: `${aliasCount} alias token(s), max depth ${maxDepth}`,
  });

  return findings;
}

function spacingRule(config: ThemeConfig): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const entries = walkTokens(config.root);
  const spacingValues = new Map<number, string[]>();

  for (const entry of entries) {
    if (entry.type !== "dimension") continue;
    const value = entry.token.$value as { value?: unknown; unit?: unknown } | undefined;
    if (!value || typeof value.value !== "number" || typeof value.unit !== "string") continue;

    const where = entry.path.join(".");
    const group = entry.path[0];

    if (value.unit !== "px" && value.unit !== "rem") {
      findings.push({
        rule: "spacing",
        severity: "error",
        path: where,
        message: `dimension unit "${value.unit}" is not px or rem`,
      });
    }
    if (value.value < 0) {
      findings.push({
        rule: "spacing",
        severity: "error",
        path: where,
        message: `negative dimension ${value.value}${value.unit}`,
      });
    }
    if (value.unit === "px" && !Number.isInteger(value.value)) {
      findings.push({
        rule: "spacing",
        severity: "warning",
        path: where,
        message: `fractional px ${value.value}px`,
      });
    }
    if (group === "spacing" && value.unit === "px" && value.value % 2 !== 0) {
      findings.push({
        rule: "spacing",
        severity: "warning",
        path: where,
        message: `${value.value}px is not a multiple of 2px`,
      });
    }
    if (group === "spacing" && value.unit === "px") {
      const list = spacingValues.get(value.value) ?? [];
      list.push(where);
      spacingValues.set(value.value, list);
    }
  }

  for (const [value, paths] of spacingValues) {
    if (paths.length > 1) {
      findings.push({
        rule: "spacing",
        severity: "info",
        path: paths.join(", "),
        message: `duplicate spacing value ${value}px`,
      });
    }
  }

  return findings;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function auditTheme(config: ThemeConfig, options: AuditOptions = {}): AuditResult {
  const rules = options.rules ?? ALL_RULES;
  const colors = flatColors(config);
  const findings: AuditFinding[] = [];

  if (rules.includes("contrast")) {
    findings.push(...contrastRule(colors, options.minContrast ?? 4.5));
  }
  if (rules.includes("palette")) {
    findings.push(
      ...paletteRule(
        colors,
        options.group ?? "color.island",
        options.minDeltaE ?? 10,
        options.minCvdDeltaE ?? 6,
        options.minHueDiff ?? 15
      )
    );
  }
  if (rules.includes("alias")) {
    findings.push(...aliasRule(config));
  }
  if (rules.includes("spacing")) {
    findings.push(...spacingRule(config));
  }

  const count = (severity: Severity) => findings.filter((f) => f.severity === severity).length;

  return {
    findings,
    summary: { errors: count("error"), warnings: count("warning"), infos: count("info") },
  };
}
