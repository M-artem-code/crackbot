'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BellIcon,
  BotIcon,
  CalendarClockIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  ServerIcon,
  SparklesIcon,
  ListChecksIcon,
  Settings2Icon,
  TerminalIcon,
} from 'lucide-react'

import { ThemeToggle } from '@/components/theme-toggle'
import { authClient } from '@/lib/auth-client'
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
      { title: 'Агенты', href: '/agents', icon: ServerIcon },
    ],
  },
  {
    label: 'Автоматизация',
    items: [
      { title: 'Расписания', href: '/schedules', icon: CalendarClockIcon },
      { title: 'Уведомления', href: '/notifications', icon: BellIcon },
      { title: 'AI-ассистент', href: '/assistant', icon: SparklesIcon },
      { title: 'Настройки AI', href: '/settings/ai', icon: Settings2Icon },
    ],
  },
]

export function AppSidebar({ user, workspaceName, unreadNotifications = 0, initialTheme }: { user: { name: string; email: string }; workspaceName: string; unreadNotifications?: number; initialTheme: 'light' | 'dark' }) {
  const pathname = usePathname()

  async function signOut() {
    await authClient.signOut()
    window.location.href = '/sign-in'
  }

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
                        {item.href === '/notifications' && unreadNotifications > 0 ? <span className="ml-auto flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 font-mono text-[10px] text-primary-foreground">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span> : null}
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
        <div className="flex flex-col gap-3 rounded-xl bg-sidebar-accent p-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{user.name}</p>
            <p className="truncate text-[10px] text-muted-foreground">{user.email}</p>
            <p className="truncate font-mono text-[10px] text-primary">{workspaceName}</p>
          </div>
          <button type="button" onClick={signOut} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-sidebar hover:text-sidebar-foreground">
            <LogOutIcon className="size-3.5" />
            Выйти
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
