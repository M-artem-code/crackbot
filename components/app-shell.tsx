import { cookies } from 'next/headers'

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'

export async function AppShell({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const theme = cookieStore.get('botforge_theme')?.value === 'light' ? 'light' : 'dark'
  return (
    <SidebarProvider>
      <AppSidebar initialTheme={theme} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
