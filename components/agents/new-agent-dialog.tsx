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
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  const [pairingToken, setPairingToken] = React.useState<string | null>(null)
  const [pairingExpiresAt, setPairingExpiresAt] = React.useState<string | null>(null)
  const [createdName, setCreatedName] = React.useState('')
  const [setupOpen, setSetupOpen] = React.useState(false)

  function submit() {
    setError(null)
    startTransition(async () => {
      try {
        const res = await createAgent({ name, os: 'Windows 10/11' })
        setPairingToken(res.pairingToken)
        setPairingExpiresAt(res.pairingExpiresAt)
        setCreatedName(name.trim())
        setOpen(false)
        setName('')
        setSetupOpen(true)
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
              Добавьте Windows 10/11 компьютер для безопасного запуска bot.py в Docker. После создания откроется пошаговая установка.
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
