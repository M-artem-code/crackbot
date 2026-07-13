import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4" aria-busy="true">
      <div className="flex w-full max-w-4xl overflow-hidden rounded-xl border bg-card md:min-h-[520px]">
        <section className="hidden flex-1 flex-col justify-between border-r bg-sidebar p-8 md:flex">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-lg" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <Skeleton className="size-9" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-4/5" />
            <Skeleton className="h-4 w-full" />
          </div>
          <Skeleton className="h-3 w-56" />
        </section>
        <section className="flex flex-1 items-center justify-center p-5 sm:p-8">
          <div className="flex w-full max-w-sm flex-col gap-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="mt-4 h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </section>
      </div>
    </main>
  )
}
