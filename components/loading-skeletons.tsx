import { AppShell } from '@/components/app-shell'
import { PageHeader } from '@/components/page-header'
import { Skeleton } from '@/components/ui/skeleton'

function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={`rounded-lg border bg-card p-4 ${className ?? ''}`}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-16" />
      <Skeleton className="mt-2 h-3 w-32" />
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <AppShell>
      <PageHeader title="Дашборд" description="загрузка…" />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border bg-card p-4 lg:col-span-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-4 h-[240px] w-full" />
          </div>
          <div className="rounded-lg border bg-card p-4">
            <Skeleton className="h-4 w-32" />
            <div className="mt-4 flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  )
}

export function BotsSkeleton() {
  return (
    <AppShell>
      <PageHeader title="Мои боты" description="загрузка…" />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-72" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2">
                <Skeleton className="size-9 rounded-md" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="mt-1.5 h-3 w-20" />
                </div>
              </div>
              <Skeleton className="mt-4 h-3 w-full" />
              <div className="mt-4 flex justify-between">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
              </div>
              <Skeleton className="mt-4 h-4 w-full" />
            </div>
          ))}
        </div>
      </main>
    </AppShell>
  )
}

export function BotDetailSkeleton() {
  return (
    <AppShell>
      <PageHeader title="Загрузка бота…" description="загрузка…" />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="ml-auto h-9 w-44" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <Skeleton className="h-[280px] w-full rounded-lg" />
      </main>
    </AppShell>
  )
}

export function CreateSkeleton() {
  return (
    <AppShell>
      <PageHeader title="Создать бота" description="загрузка…" />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </main>
    </AppShell>
  )
}

export function AgentsSkeleton() {
  return (
    <AppShell>
      <PageHeader title="Агенты" description="загрузка…" />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-40 w-full rounded-lg" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="mt-3 h-3 w-32" />
              <Skeleton className="mt-4 h-14 w-full" />
              <Skeleton className="mt-3 h-9 w-full" />
            </div>
          ))}
        </div>
      </main>
    </AppShell>
  )
}

export function AssistantSkeleton() {
  return (
    <AppShell>
      <PageHeader title="AI-ассистент" description="загрузка…" />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div className="flex flex-1 flex-col gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton
              key={i}
              className={`h-16 rounded-lg ${i % 2 === 0 ? 'w-2/3' : 'ml-auto w-1/2'}`}
            />
          ))}
        </div>
        <Skeleton className="h-12 w-full rounded-lg" />
      </main>
    </AppShell>
  )
}
