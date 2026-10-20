import { Monitor, Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useTheme, type ThemeChoice } from '@/lib/theme'

const NEXT: Record<ThemeChoice, ThemeChoice> = { system: 'light', light: 'dark', dark: 'system' }
const LABEL: Record<ThemeChoice, string> = { system: 'Theo máy', light: 'Sáng', dark: 'Tối' }

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(NEXT[theme])}
      title={`Giao diện: ${LABEL[theme]} (bấm để đổi)`}
    >
      <Icon />
      <span className="hidden sm:inline">{LABEL[theme]}</span>
    </Button>
  )
}
