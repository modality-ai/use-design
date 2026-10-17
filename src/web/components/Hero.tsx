import { useState, useEffect } from 'hono/jsx'

function getThemeName(): string {
  const link = document.getElementById('theme-css') as HTMLLinkElement | null
  const href = link?.getAttribute('href') ?? ''
  const match = href.match(/themes\/(\w+)\.css/)
  const slug = match?.[1] ?? 'apple'
  return slug.charAt(0).toUpperCase() + slug.slice(1)
}

export function Hero() {
  const [themeName, setThemeName] = useState(getThemeName)

  useEffect(() => {
    const link = document.getElementById('theme-css')
    if (!link) return
    const observer = new MutationObserver(() => setThemeName(getThemeName()))
    observer.observe(link, { attributes: true, attributeFilter: ['href'] })
    return () => observer.disconnect()
  }, [])

  const label = `Design System Inspired by ${themeName}`

  return (
    <section class="hero">
      <div class="hero-content">
        <p class="hero-eyebrow">{label}</p>
        <h1 class="hero-title">{label}</h1>
        <p class="hero-subtitle">
          A visual reference generated from DESIGN.md — every color, type rule, and component token documented.
        </p>
        <p class="hero-tagline">Precision engineering meets editorial design</p>
        <div class="hero-actions">
          <a href="#colors" class="btn-secondary">Subscribe</a>
          <a href="#buttons" class="btn-pill-outline">Configure</a>
        </div>
      </div>
    </section>
  )
}
