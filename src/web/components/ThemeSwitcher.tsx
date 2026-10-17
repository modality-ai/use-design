import { useState, useEffect } from 'hono/jsx'
import { useDarkMode } from '../hooks/useDarkMode'

export function ThemeSwitcher() {
  const [themes, setThemes] = useState<string[]>([])

  const [current, setCurrent] = useState(() => {
    const link = document.getElementById('theme-css') as HTMLLinkElement | null
    const href = link?.getAttribute('href') ?? ''
    const match = href.match(/themes\/(\w+)\.css/)
    return match?.[1] ?? 'apple'
  })

  const [mode, toggleMode] = useDarkMode()

  useEffect(() => {
    fetch('/api/themes')
      .then((r) => r.json())
      .then((data: string[]) => setThemes(data))
  }, [])

  const switchTheme = (theme: string) => {
    const link = document.getElementById('theme-css') as HTMLLinkElement | null
    if (link) {
      link.setAttribute('href', `/styles/themes/${theme}.css`)
      setCurrent(theme)
      window.history.pushState(null, '', `/design-md/${theme}/preview`)
    }
  }

  return (
    <div class="theme-switcher">
      <button
        class="theme-switcher-mode"
        onClick={toggleMode}
        aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
        title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
      >
        {mode === 'dark' ? '☀' : '☾'}
      </button>
      <span class="theme-switcher-divider" />
      <select
        class="theme-switcher-selector"
        value={current}
        onChange={(e) => switchTheme((e.target as HTMLSelectElement).value)}
        aria-label="Select theme"
      >
        {themes.map((t) => (
          <option key={t} value={t}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </option>
        ))}
      </select>
    </div>
  )
}
