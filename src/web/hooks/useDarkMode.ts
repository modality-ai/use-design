import { useState, useEffect } from 'react'

const STORAGE_KEY = 'theme-mode'

/**
 * Resolve the initial mode:
 *   1. localStorage (user has explicitly chosen)
 *   2. OS preference (prefers-color-scheme)
 *   3. Default: dark
 */
function resolveInitialMode(): 'dark' | 'light' {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // localStorage blocked (private browsing, etc.)
  }
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light'
  }
  return 'dark'
}

/**
 * Apply mode to the document root.
 * - data-mode: drives component-level CSS overrides (:root[data-mode="light"])
 * - data-theme: drives YAML color token overrides ([data-theme="light"])
 * Both must be set together so the two CSS layers stay in sync.
 */
function applyMode(mode: 'dark' | 'light'): void {
  const root = document.documentElement
  root.setAttribute('data-mode', mode)
  if (mode === 'light') {
    root.setAttribute('data-theme', 'light')
  } else {
    root.removeAttribute('data-theme')
  }
}

/**
 * Persist mode choice to localStorage.
 */
function persistMode(mode: 'dark' | 'light'): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // ignore write errors
  }
}

/**
 * Hook: manages dark/light mode with persistence and OS preference detection.
 *
 * @returns [mode, toggleMode]
 */
export function useDarkMode(): ['dark' | 'light', () => void] {
  const [mode, setMode] = useState<'dark' | 'light'>(() => resolveInitialMode())

  // Apply on mount and whenever mode changes
  useEffect(() => {
    applyMode(mode)
    persistMode(mode)
  }, [mode])

  // Also listen for OS preference changes (user changes system settings)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onOsChange = (e: MediaQueryListEvent) => {
      // Only follow OS changes if user has not explicitly chosen
      try {
        if (!localStorage.getItem(STORAGE_KEY)) {
          setMode(e.matches ? 'light' : 'dark')
        }
      } catch {
        setMode(e.matches ? 'light' : 'dark')
      }
    }
    mq.addEventListener('change', onOsChange)
    return () => mq.removeEventListener('change', onOsChange)
  }, [])

  const toggleMode = () => {
    setMode((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  return [mode, toggleMode]
}

/**
 * Inline script source for FOUC (Flash of Unstyled Content) prevention.
 * Inject this as a <script> in <head> before any CSS loads.
 *
 * Reads localStorage → OS preference → default dark, then sets both
 * data-mode and data-theme on <html> synchronously before paint.
 */
export const FOUC_PREVENTION_SCRIPT = `(function(){
  var mode='dark';
  try{var s=localStorage.getItem('theme-mode');if(s==='light'||s==='dark')mode=s;}catch(e){}
  if(mode==='dark'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme:light)').matches){
    try{if(!localStorage.getItem('theme-mode'))mode='light';}catch(e){mode='light';}
  }
  document.documentElement.setAttribute('data-mode',mode);
  if(mode==='light')document.documentElement.setAttribute('data-theme','light');
})();`
