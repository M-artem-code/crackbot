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
  agentName: string
  apiKey: string | null
  title: string
  description: string
}

export function ApiKeyDialog({
  open,
  onOpenChange,
  agentName,
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-xs text-warning">
          <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Скопируйте ключ сейчас — он показывается полностью только один раз. Хранить его
            нужно в безопасном месте.
          </span>
        </div>

        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2">
          <code className="min-w-0 flex-1 truncate font-mono text-xs">{apiKey ?? '—'}</code>
          <Button variant="outline" size="icon-sm" onClick={copy} aria-label="Скопировать ключ">
            {copied ? <CheckIcon className="text-primary" /> : <CopyIcon />}
          </Button>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => apiKey && downloadAgentConfig(agentName, apiKey)}
          >
            <DownloadIcon data-icon="inline-start" />
            Скачать конфиг
          </Button>
          <DialogClose render={<Button />}>Готово</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
