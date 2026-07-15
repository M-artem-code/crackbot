'use client'

import * as React from 'react'
import { CheckIcon, CopyIcon, DownloadIcon, TriangleAlertIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { downloadAgentConfig } from '@/lib/agent-config'

interface ApiKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiKey: string | null
  title: string
  description: string
}

export function ApiKeyDialog({
  open,
  onOpenChange,
  apiKey,
  title,
  description,
}: ApiKeyDialogProps) {
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!open) setCopied(false)
  }, [open])

  async function copy() {
    if (!apiKey) return
    await navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] min-w-0 max-w-xl overflow-hidden">
        <DialogHeader className="min-w-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-pretty">{description}</DialogDescription>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            <TriangleAlertIcon className="mt-0.5 shrink-0" />
            <span className="min-w-0 text-pretty">
              Старый ключ уже отключён. Новый ключ показывается полностью только один раз.
            </span>
          </div>

          <ol className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4 text-sm">
            <li><strong>1.</strong> Остановите запущенный Runner.</li>
            <li><strong>2.</strong> Скачайте новый файл <code className="font-mono">agent-config.json</code>.</li>
            <li><strong>3.</strong> Замените старый файл рядом с <code className="font-mono">windows_runner.py</code>.</li>
            <li><strong>4.</strong> Запустите Runner снова — связь восстановится автоматически.</li>
          </ol>

          <div className="flex min-w-0 items-center gap-2 rounded-lg border bg-muted/40 p-2">
            <code className="min-w-0 flex-1 truncate font-mono text-xs" title={apiKey ?? undefined}>{apiKey ?? '—'}</code>
            <Button variant="outline" size="icon-sm" onClick={copy} aria-label="Скопировать ключ">
              {copied ? <CheckIcon className="text-primary" /> : <CopyIcon />}
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Если Runner настроен через переменную <code className="font-mono">CRACKBOT_API_KEY</code>, скопируйте новый ключ и обновите её вместо файла.
          </p>
        </div>

        <DialogFooter className="min-w-0 flex-col-reverse sm:flex-row sm:flex-wrap">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => apiKey && downloadAgentConfig(apiKey)}
          >
            <DownloadIcon data-icon="inline-start" />
            Скачать agent-config.json
          </Button>
          <DialogClose render={<Button className="w-full sm:w-auto" />}>Готово</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
