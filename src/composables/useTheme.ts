import { ref, watch } from 'vue'

export type ThemeId = 'green' | 'cobalt' | 'amber' | 'violet' | 'cyan'

export interface ThemeDef {
  id: ThemeId
  nameKey: string
  accent: string  // preview swatch color
}

export const THEMES: ThemeDef[] = [
  { id: 'green',  nameKey: 'theme.green',  accent: '#4caf50' },
  { id: 'cobalt', nameKey: 'theme.cobalt', accent: '#4a9eff' },
  { id: 'amber',  nameKey: 'theme.amber',  accent: '#ff9800' },
  { id: 'violet', nameKey: 'theme.violet', accent: '#9c27b0' },
  { id: 'cyan',   nameKey: 'theme.cyan',   accent: '#00bcd4' },
]

const STORAGE_KEY = 'gtnh_idle_theme'

function applyTheme(id: ThemeId) {
  if (id === 'green') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', id)
  }
}

const currentTheme = ref<ThemeId>(
  (localStorage.getItem(STORAGE_KEY) as ThemeId | null) ?? 'green'
)

// Apply on first load
applyTheme(currentTheme.value)

watch(currentTheme, (id) => {
  applyTheme(id)
  localStorage.setItem(STORAGE_KEY, id)
})

export function useTheme() {
  function setTheme(id: ThemeId) {
    currentTheme.value = id
  }

  return { currentTheme, setTheme, THEMES }
}
