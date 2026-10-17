import { useState } from 'react'

export function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav class="site-nav">
      <div class="nav-inner">
        <a href="/" class="nav-logo" aria-label="Home">
          <svg width="17" height="17" viewBox="0 0 17 17" fill="currentColor">
            <path d="M15.5 8.5a7 7 0 1 1-14 0 7 7 0 0 1 14 0zm-3.8-1.8a3.2 3.2 0 0 0-2.7-1.5c-1.2 0-1.7.6-2.5.6S5.3 5.2 4.3 5.2A3.4 3.4 0 0 0 1.5 7.6c-.8 2.1.3 5.2 2 6.9.6.6 1.2 1.3 2.1 1.3s1.2-.6 2.4-.6 1.4.6 2.4.6 1.4-.6 2-1.3a7 7 0 0 0 .9-1.8 3 3 0 0 1-1.6-2.7 3 3 0 0 1 1.5-2.6z" />
          </svg>
        </a>

        <div class={`nav-links ${menuOpen ? 'nav-links--open' : ''}`}>
          <a href="#colors" class="nav-link">Colors</a>
          <a href="#typography" class="nav-link">Typography</a>
          <a href="#buttons" class="nav-link">Buttons</a>
          <a href="#cards" class="nav-link">Cards</a>
          <a href="#forms" class="nav-link">Forms</a>
          <a href="#spacing" class="nav-link">Spacing</a>
        </div>

        <button
          class="nav-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span class={`nav-toggle-bar ${menuOpen ? 'nav-toggle-bar--open' : ''}`} />
        </button>
      </div>
    </nav>
  )
}
