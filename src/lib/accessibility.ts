import { ref, watch } from 'vue'

export type FontSize = 'normal' | 'large' | 'larger'
export type ThemeMode = 'light' | 'dark'

const FONT_SIZE_PX: Record<FontSize, string> = {
  normal: '17px',
  large: '19px',
  larger: '21px',
}

const STORAGE_KEY = 'lendit:accessibility'

interface StoredPrefs {
  fontSize: FontSize
  theme: ThemeMode
  colorblind: boolean
}

function readStored(): StoredPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) throw new Error('empty')
    const parsed = JSON.parse(raw) as Partial<StoredPrefs>
    return {
      fontSize: parsed.fontSize ?? 'normal',
      // Migración: la opción anterior "system" pasa a claro.
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
      colorblind: parsed.colorblind ?? false,
    }
  } catch {
    return { fontSize: 'normal', theme: 'light', colorblind: false }
  }
}

const stored = readStored()
export const fontSize = ref<FontSize>(stored.fontSize)
export const theme = ref<ThemeMode>(stored.theme)
export const colorblind = ref<boolean>(stored.colorblind)

function applyToDocument() {
  const root = document.documentElement
  root.style.fontSize = FONT_SIZE_PX[fontSize.value]

  root.setAttribute('data-theme', theme.value)

  root.toggleAttribute('data-colorblind', colorblind.value)

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ fontSize: fontSize.value, theme: theme.value, colorblind: colorblind.value }),
    )
  } catch {
    // Modo privado o storage bloqueado: la preferencia solo dura la sesión.
  }
}

export function initAccessibility() {
  applyToDocument()
  watch([fontSize, theme, colorblind], applyToDocument)
}
