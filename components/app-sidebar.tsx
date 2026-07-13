'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BotIcon,
  LayoutDashboardIcon,
  PlusCircleIcon,
  ServerIcon,
  SparklesIcon,
  TerminalIcon,
} from 'lucide-react'

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

const navItems = [
  { title: 'Дашборд', href: '/', icon: LayoutDashboardIcon },
  { title: 'Мои боты', href: '/bots', icon: BotIcon },
  { title: 'Агенты', href: '/agents', icon: ServerIcon },
  { title: 'Создать бота', href: '/create', icon: PlusCircleIcon },
  { title: 'AI-ассистент', href: '/assistant', icon: SparklesIcon },
]

export function AppSidebar() {
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
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Платформа</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.href)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
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
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2 rounded-md bg-sidebar-accent px-3 py-2.5">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full rounded-full bg-primary animate-status-pulse" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          <div className="flex flex-col">
            <span className="text-xs font-medium">Локальный раннер</span>
            <span className="font-mono text-[10px] text-muted-foreground">
              подключен · v1.4.2
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
