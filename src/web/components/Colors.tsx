import { useState, useEffect } from 'react'

interface ColorToken {
  variable: string
  label: string
  group: string
  value: string
}

function extractColorTokens(): ColorToken[] {
  const tokens: ColorToken[] = []
  const seen = new Set<string>()

  // Parse --color-* variables from all stylesheets by reading CSS text
  for (const sheet of document.styleSheets) {
    let text: string
    try {
      text = Array.from(sheet.cssRules).map((r) => r.cssText).join('\n')
    } catch {
      continue
    }

    // Match all --color-xxx: value patterns from CSS text
    const regex = /(--color-[\w-]+)\s*:\s*([^;}]+)/g
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
      const variable = match[1]!
      if (seen.has(variable)) continue
      seen.add(variable)

      // Resolve actual computed value
      const computed = getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
      if (!computed) continue

      const parts = variable.replace('--color-', '').split('-')
      const group = formatGroup(parts[0] ?? '')
      const label = parts.slice(1).map(capitalize).join(' ') || capitalize(parts[0] ?? '')

      tokens.push({ variable, label, group, value: computed })
    }
  }

  return tokens
}

function formatGroup(key: string): string {
  const map: Record<string, string> = {
    bg: 'Background',
    text: 'Text',
    link: 'Link',
    btn: 'Button',
    nav: 'Navigation',
    input: 'Input',
    accent: 'Brand',
    shadow: 'Elevation',
    border: 'Border',
  }
  return map[key] ?? capitalize(key)
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function groupBy(arr: ColorToken[]): Record<string, ColorToken[]> {
  const result: Record<string, ColorToken[]> = {}
  for (const item of arr) {
    if (!result[item.group]) result[item.group] = []
    result[item.group]!.push(item)
  }
  return result
}

export function Colors() {
  const [tokens, setTokens] = useState<ColorToken[]>([])

  useEffect(() => {
    const scan = () => setTokens(extractColorTokens())

    // Initial scan with slight delay to ensure stylesheet is parsed
    setTimeout(scan, 200)

    // Re-scan when mode changes
    const observer = new MutationObserver(() => setTimeout(scan, 200))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] })

    // Re-scan when theme stylesheet loads
    const link = document.getElementById('theme-css')
    const onLoad = () => setTimeout(scan, 200)
    if (link) link.addEventListener('load', onLoad)

    return () => {
      observer.disconnect()
      if (link) link.removeEventListener('load', onLoad)
    }
  }, [])

  const groups = groupBy(tokens)
  const groupNames = Object.keys(groups)

  if (groupNames.length === 0) return null

  return (
    <section id="colors" class="section section-alt">
      <div class="section-inner">
        <h2 class="section-heading">Colors</h2>
        <p class="section-description">
          Auto-detected from the active TailwindCSS v4 theme.
          Switch themes to see different palettes.
        </p>
        <div class="color-groups">
          {groupNames.map((name) => (
            <div class="color-group" key={name}>
              <h3 class="color-group-title">{name}</h3>
              <div class="color-swatches">
                {groups[name]!.map((t) => (
                  <div class="color-swatch" key={t.variable}>
                    <div
                      class="swatch-preview"
                      style={{
                        backgroundColor: t.value,
                        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)',
                      }}
                    />
                    <div class="swatch-info">
                      <span class="swatch-label">{t.label}</span>
                      <code class="swatch-value">{t.value}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
