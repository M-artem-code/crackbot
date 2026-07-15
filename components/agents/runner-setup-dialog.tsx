'use client'

import * as React from 'react'
import { CheckCircle2Icon, DownloadIcon, ExternalLinkIcon, Loader2Icon, ShieldAlertIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentName: string
  pairingToken: string | null
  expiresAt: string | null
}

export function RunnerSetupDialog({ open, onOpenChange, agentName, pairingToken, expiresAt }: Props) {
  const [downloading, setDownloading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function download() {
    if (!pairingToken) return
    setDownloading(true)
    setError(null)
    try {
      const response = await fetch('/api/runner/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairingToken }),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { message?: string } | null
        throw new Error(result?.message || 'Не удалось скачать установщик')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `BotForgeRunner-${pairingToken}.exe`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось скачать установщик')
    } finally {
      setDownloading(false)
    }
  }

  const expiry = expiresAt ? new Intl.DateTimeFormat('ru', { hour: '2-digit', minute: '2-digit' }).format(new Date(expiresAt)) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Подключите {agentName}</DialogTitle>
          <DialogDescription>Установщик один раз привяжет этот Windows-компьютер к агенту. Секретный ключ сохранится в Windows Credential Manager.</DialogDescription>
        </DialogHeader>
        <ol className="flex flex-col gap-4 text-sm">
          <li className="flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">1</span><div className="flex flex-col gap-2"><p className="font-medium">Установите и запустите Docker Desktop</p><p className="leading-relaxed text-muted-foreground">Docker изолирует bot.py от ваших файлов и Windows. Раннер не запускает код напрямую на компьютере.</p><Button variant="outline" size="sm" className="w-fit" render={<a href="https://www.docker.com/products/docker-desktop/" target="_blank" rel="noreferrer" />}><ExternalLinkIcon data-icon="inline-start" />Открыть Docker Desktop</Button></div></li>
          <li className="flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">2</span><div className="flex flex-col gap-2"><p className="font-medium">Скачайте персональный BotForge Runner</p><p className="leading-relaxed text-muted-foreground">Код подключения одноразовый и действует до {expiry || '10 минут'}. Не пересылайте установщик другим людям.</p><Button size="sm" className="w-fit" onClick={download} disabled={!pairingToken || downloading}>{downloading ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <DownloadIcon data-icon="inline-start" />}Скачать Windows beta</Button>{error ? <p className="text-xs text-destructive">{error}</p> : null}</div></li>
          <li className="flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">3</span><div className="flex flex-col gap-2"><p className="font-medium">Запустите setup и дождитесь статуса «Онлайн»</p><p className="leading-relaxed text-muted-foreground">Windows SmartScreen может показать предупреждение, потому что beta пока не подписана. После входа в Windows раннер запускается в tray автоматически.</p></div></li>
        </ol>
        <div className="flex gap-3 rounded-lg border border-border bg-muted p-3 text-xs leading-relaxed text-muted-foreground"><ShieldAlertIcon className="size-4 shrink-0 text-foreground" /><p>Лимиты beta: один бот, 1 CPU, 512 MB RAM и максимум 15 минут. Интернет доступен, но файлы ПК, Docker socket и права администратора контейнеру не выдаются.</p></div>
        <Button variant="outline" onClick={() => onOpenChange(false)}><CheckCircle2Icon data-icon="inline-start" />Понятно</Button>
      </DialogContent>
    </Dialog>
  )
}
