'use client'

import * as React from 'react'
import { MoonIcon, SunIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function ThemeToggle({ initialTheme }: { initialTheme: 'light' | 'dark' }) {
  const [theme, setTheme] = React.useState(initialTheme)

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.classList.toggle('dark', next === 'dark')
    document.cookie = `botforge_theme=${next}; path=/; max-age=31536000; samesite=lax`
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggleTheme} className="w-full justify-start">
      {theme === 'dark' ? <SunIcon data-icon="inline-start" /> : <MoonIcon data-icon="inline-start" />}
      {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
    </Button>
  )
}
