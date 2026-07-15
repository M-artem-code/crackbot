'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BotIcon,
  LayoutDashboardIcon,
  SparklesIcon,
  ListChecksIcon,
  Settings2Icon,
  TerminalIcon,
} from 'lucide-react'

import { ThemeToggle } from '@/components/theme-toggle'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

const navGroups = [
  {
    label: 'Рабочее пространство',
    items: [
      { title: 'Обзор', href: '/', icon: LayoutDashboardIcon },
      { title: 'Боты', href: '/bots', icon: BotIcon },
      { title: 'Прогоны', href: '/runs', icon: ListChecksIcon },
    ],
  },
  {
    label: 'Автоматизация',
    items: [
      { title: 'AI-ассистент', href: '/assistant', icon: SparklesIcon },
      { title: 'Настройки AI', href: '/settings/ai', icon: Settings2Icon },
    ],
  },
]

export function AppSidebar({ initialTheme }: { initialTheme: 'light' | 'dark' }) {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <TerminalIcon className="size-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight">BotForge</span>
            <span className="font-mono text-[10px] text-muted-foreground leading-tight">
              qa automation
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 py-3">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="px-3 text-xs">{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {group.items.map((item) => {
                  const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        size="lg"
                        className="min-h-11 rounded-lg text-sm"
                        render={<Link href={item.href} />}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <ThemeToggle initialTheme={initialTheme} />
      </SidebarFooter>
    </Sidebar>
  )
}
