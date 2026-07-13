'use client'

import * as React from 'react'
import { PlusIcon } from 'lucide-react'

import { createAgent } from '@/app/actions/agents'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { ApiKeyDialog } from '@/components/agents/api-key-dialog'

export function NewAgentDialog() {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [os, setOs] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  const [createdKey, setCreatedKey] = React.useState<string | null>(null)
  const [createdName, setCreatedName] = React.useState('')
  const [keyDialogOpen, setKeyDialogOpen] = React.useState(false)

  function submit() {
    setError(null)
    startTransition(async () => {
      try {
        const res = await createAgent({ name, os: os || undefined })
        setCreatedKey(res.apiKey)
        setCreatedName(name.trim())
        setOpen(false)
        setName('')
        setOs('')
        setKeyDialogOpen(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось создать агента')
      }
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button size="sm" />}>
          <PlusIcon data-icon="inline-start" />
          Новый агент
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый агент-раннер</DialogTitle>
            <DialogDescription>
              Агент — это машина, которая забирает задания и запускает ботов. После создания
              вы получите API-ключ для подключения.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agent-name">Имя агента</Label>
              <Input
                id="agent-name"
                placeholder="напр. mac-studio-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agent-os">
                ОС <span className="font-normal text-muted-foreground">(необязательно)</span>
              </Label>
              <Input
                id="agent-os"
                placeholder="напр. macOS 15 / Ubuntu 24.04"
                value={os}
                onChange={(e) => setOs(e.target.value)}
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Отмена</DialogClose>
            <Button onClick={submit} disabled={pending || !name.trim()}>
              {pending && <Spinner data-icon="inline-start" />}
              Создать агента
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ApiKeyDialog
        open={keyDialogOpen}
        onOpenChange={setKeyDialogOpen}
        agentName={createdName}
        apiKey={createdKey}
        title="Агент создан"
        description="Используйте этот ключ для подключения агента к серверу."
      />
    </>
  )
}
