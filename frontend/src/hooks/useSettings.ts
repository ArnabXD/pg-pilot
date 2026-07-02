import { useEffect, useState } from 'react'

export type Theme = 'system' | 'light' | 'dark'

const THEME_KEY = 'pg-pilot:theme'
const SCALE_KEY = 'pg-pilot:scale'

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.classList.toggle('light', theme === 'light')
}

function applyScale(scale: number) {
  document.documentElement.style.setProperty('--ui-scale', String(scale))
}

export function useSettings() {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(THEME_KEY) as Theme) || 'system',
  )
  const [scale, setScaleState] = useState<number>(
    () => Number(localStorage.getItem(SCALE_KEY)) || 1,
  )

  useEffect(() => applyTheme(theme), [theme])
  useEffect(() => applyScale(scale), [scale])

  function setTheme(t: Theme) {
    localStorage.setItem(THEME_KEY, t)
    setThemeState(t)
  }

  function setScale(s: number) {
    localStorage.setItem(SCALE_KEY, String(s))
    setScaleState(s)
  }

  return { theme, setTheme, scale, setScale }
}
