/**
 * Giao diện sáng / tối / theo máy. Tự viết thay cho next-themes: thư viện đó chèn thẻ
 * <script> trong component, React 19 cảnh báo và không chạy script ấy. Việc đặt class
 * `dark` trước khi vẽ trang (tránh nháy trắng) nằm trong index.html.
 */
import { useEffect, useSyncExternalStore } from 'react'

export type ThemeChoice = 'light' | 'dark' | 'system'

const KEY = 'ban-tin-sang/theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

function resolve(choice: ThemeChoice): 'light' | 'dark' {
  return choice === 'system' ? (media().matches ? 'dark' : 'light') : choice
}

function apply() {
  document.documentElement.classList.toggle('dark', resolve(read()) === 'dark')
  listeners.forEach((l) => l())
}

export function setTheme(choice: ThemeChoice) {
  try {
    if (choice === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, choice)
  } catch {
    /* chỉ không nhớ được lựa chọn */
  }
  apply()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, read)
  const resolvedTheme = useSyncExternalStore(subscribe, () => resolve(read()))
  useEffect(() => {
    // Người dùng chọn "theo máy" thì đổi theo khi hệ điều hành đổi sáng / tối
    const m = media()
    m.addEventListener('change', apply)
    return () => m.removeEventListener('change', apply)
  }, [])
  return { theme, resolvedTheme, setTheme }
}
