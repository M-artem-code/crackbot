"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  DownloadIcon,
  MoreVerticalIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
  PowerIcon,
  PencilIcon,
  DatabaseIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RefStatusBadge } from "@/components/status-badge"
import { formatDateTime, type BotRef } from "@/lib/mock-data"
import {
  addRef,
  deleteRef,
  importRefs,
  resetRefCounters,
  toggleRef,
  updateRefLimit,
} from "@/app/actions/refs"

export function RefPoolManager({
  botId,
  refs,
}: {
  botId: string
  refs: BotRef[]
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const activeCount = refs.filter((r) => r.status === "active").length

  function run(fn: () => Promise<unknown>, id?: string) {
    setError(null)
    setBusyId(id ?? null)
    startTransition(async () => {
      try {
        await fn()
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось выполнить действие")
      } finally {
        setBusyId(null)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="flex items-center gap-2">
              <DatabaseIcon className="size-4" />
              <span className="font-mono">Пул целевых ссылок</span>
            </CardTitle>
            <CardDescription>
              Бот проходит активные ссылки по очереди до лимита успешных регистраций
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 border-primary/40 text-primary">
              <span className="size-1.5 rounded-full bg-primary animate-status-pulse" />
              {activeCount} активных
            </Badge>
            <Badge variant="secondary" className="font-mono">
              {refs.length} ссылок
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <AddRefDialog botId={botId} onDone={() => router.refresh()} />
          <ImportRefsDialog botId={botId} onDone={() => router.refresh()} />
          {pending && !busyId ? <Spinner className="size-4 text-muted-foreground" /> : null}
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {refs.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-md border border-dashed py-10 text-center">
            <span className="text-sm font-medium">Пул пуст</span>
            <span className="text-xs text-muted-foreground">
              Добавьте первую целевую ссылку для регистраций
            </span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Целевая ссылка</TableHead>
                <TableHead className="hidden sm:table-cell">Прогресс</TableHead>
                <TableHead className="hidden md:table-cell">Ошибки</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Использована</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {refs.map((ref) => {
                const rowBusy = busyId === ref.id
                const pct = Math.min(
                  100,
                  Math.round((ref.successCount / Math.max(1, ref.successLimit)) * 100),
                )
                return (
                  <TableRow key={ref.id} data-busy={rowBusy}>
                    <TableCell className="max-w-[280px]">
                      <span className="block truncate font-mono text-xs">
                        {ref.url.replace(/^https?:\/\//, "")}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-xs">
                          {ref.successCount}/{ref.successLimit}
                        </span>
                        <div className="h-1 w-24 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                      {ref.failedCount}
                    </TableCell>
                    <TableCell>
                      <RefStatusBadge status={ref.status} />
                    </TableCell>
                    <TableCell className="hidden text-right font-mono text-xs text-muted-foreground lg:table-cell">
                      {formatDateTime(ref.lastUsedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {rowBusy ? (
                        <Spinner className="size-4 text-muted-foreground" />
                      ) : (
                        <RowActions
                          ref_={ref}
                          onEditLimit={(limit) =>
                            run(() => updateRefLimit(botId, Number(ref.id), limit), ref.id)
                          }
                          onReset={() =>
                            run(() => resetRefCounters(botId, Number(ref.id)), ref.id)
                          }
                          onToggle={() =>
                            run(
                              () => toggleRef(botId, Number(ref.id), ref.status === "disabled"),
                              ref.id,
                            )
                          }
                          onDelete={() =>
                            run(() => deleteRef(botId, Number(ref.id)), ref.id)
                          }
                        />
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function RowActions({
  ref_,
  onEditLimit,
  onReset,
  onToggle,
  onDelete,
}: {
  ref_: BotRef
  onEditLimit: (limit: number) => void
  onReset: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const [editOpen, setEditOpen] = React.useState(false)
  const [limit, setLimit] = React.useState(String(ref_.successLimit))
  const disabled = ref_.status === "disabled"

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Действия с рефом"
            />
          }
        >
          <MoreVerticalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              setLimit(String(ref_.successLimit))
              setEditOpen(true)
            }}
          >
            <PencilIcon className="size-4" />
            Изменить лимит
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onReset()}>
            <RotateCcwIcon className="size-4" />
            Сбросить счётчики
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onToggle()}>
            <PowerIcon className="size-4" />
            {disabled ? "Включить" : "Отключить"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => onDelete()}>
            <Trash2Icon className="size-4" />
            Удалить
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Лимит успехов</DialogTitle>
            <DialogDescription>
              После достижения лимита реф помечается как исчерпанный и не выдаётся агенту.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="ref-limit">Лимит успешных регистраций</FieldLabel>
            <Input
              id="ref-limit"
              type="number"
              min={1}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="max-w-32 font-mono"
            />
          </Field>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Отмена</DialogClose>
            <Button
              onClick={() => {
                onEditLimit(Number.parseInt(limit, 10) || 1)
                setEditOpen(false)
              }}
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function AddRefDialog({ botId, onDone }: { botId: string; onDone: () => void }) {
  const [open, setOpen] = React.useState(false)
  const [url, setUrl] = React.useState("")
  const [limit, setLimit] = React.useState("10")
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)

  function submit() {
    setError(null)
    startTransition(async () => {
      try {
        await addRef(botId, url, Number.parseInt(limit, 10) || 10)
        setUrl("")
        setLimit("10")
        setOpen(false)
        onDone()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось добавить ссылку")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DropdownMenuTriggerProxy onClick={() => setOpen(true)}>
        <PlusIcon data-icon="inline-start" />
        Добавить ссылку
      </DropdownMenuTriggerProxy>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новая целевую ссылка</DialogTitle>
          <DialogDescription>
            Добавьте одну целевую ссылку и лимит успешных регистраций для неё.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="new-ref-url">Целевая ссылка</FieldLabel>
            <Input
              id="new-ref-url"
              placeholder="https://app.example.com/r/abc123"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="font-mono"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="new-ref-limit">Лимит успехов</FieldLabel>
            <Input
              id="new-ref-limit"
              type="number"
              min={1}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="max-w-32 font-mono"
            />
            <FieldDescription>Сколько регистраций сделать по этой ссылке</FieldDescription>
          </Field>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </FieldGroup>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Отмена</DialogClose>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Spinner className="size-4" /> : null}
            Добавить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ImportRefsDialog({ botId, onDone }: { botId: string; onDone: () => void }) {
  const [open, setOpen] = React.useState(false)
  const [text, setText] = React.useState("")
  const [limit, setLimit] = React.useState("10")
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)

  function submit() {
    setError(null)
    startTransition(async () => {
      try {
        await importRefs(botId, text, Number.parseInt(limit, 10) || 10)
        setText("")
        setOpen(false)
        onDone()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось импортировать ссылки")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DropdownMenuTriggerProxy variant="outline" onClick={() => setOpen(true)}>
        <DownloadIcon data-icon="inline-start" />
        Импорт списком
      </DropdownMenuTriggerProxy>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Импорт целевую ссылок</DialogTitle>
          <DialogDescription>
            По одной ссылке в строке. Можно указать лимит через запятую: {"url,25"}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="import-text">Список ссылок</FieldLabel>
            <Textarea
              id="import-text"
              rows={8}
              placeholder={"https://app.example.com/r/a\nhttps://app.example.com/r/b,25"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="font-mono text-xs"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="import-limit">Лимит по умолчанию</FieldLabel>
            <Input
              id="import-limit"
              type="number"
              min={1}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="max-w-32 font-mono"
            />
            <FieldDescription>Применяется к строкам без явного лимита</FieldDescription>
          </Field>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </FieldGroup>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Отмена</DialogClose>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Spinner className="size-4" /> : null}
            Импортировать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Небольшой прокси-триггер: обычная кнопка, открывающая диалог по клику
// (Dialog из этого набора не требует DialogTrigger, управляем через open).
function DropdownMenuTriggerProxy({
  children,
  onClick,
  variant = "outline",
}: {
  children: React.ReactNode
  onClick: () => void
  variant?: "outline" | "default"
}) {
  return (
    <Button size="sm" variant={variant} onClick={onClick}>
      {children}
    </Button>
  )
}
