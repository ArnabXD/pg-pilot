import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Select from '@radix-ui/react-select'
import { Check, ChevronDown, X } from 'lucide-react'
import { AvailableVersions, CreateInstance, EventsOn } from '@/services/api'

export function CreateInstanceModal(props: {
  existingPorts: number[]
  onClose: () => void
  onCreated: () => void
}) {
  const [versions, setVersions] = useState<string[] | null>(null)
  const [name, setName] = useState('')
  const [version, setVersion] = useState('')
  const [port, setPort] = useState(5432)
  const [progress, setProgress] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    AvailableVersions()
      .then((vs) => {
        setVersions(vs)
        if (vs.length > 0) setVersion(vs[0])
      })
      .catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    // suggest the next free port past defaults/existing instances
    let candidate = 5432
    while (props.existingPorts.includes(candidate)) candidate++
    setPort(candidate)
  }, [props.existingPorts])

  useEffect(() => EventsOn('setup:progress', (msg: string) => setProgress(msg)), [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    setSubmitting(true)
    try {
      await CreateInstance(name.trim(), version, port)
      props.onCreated()
    } catch (err) {
      setError(String(err))
      setSubmitting(false)
    }
  }

  const closeIfIdle = (o: boolean) => {
    if (!o && !submitting) props.onClose()
  }

  return (
    <Dialog.Root open onOpenChange={closeIfIdle}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-backdrop" />
        <Dialog.Content className="modal" asChild>
          <form onSubmit={submit}>
            <div className="flex items-center justify-between">
              <Dialog.Title className="modal-title">New instance</Dialog.Title>
              <Dialog.Close asChild>
                <button type="button" className="icon-btn" aria-label="Close" disabled={submitting}>
                  <X size={14} />
                </button>
              </Dialog.Close>
            </div>

            {submitting ? (
              <p className="muted">{progress || 'working…'}</p>
            ) : (
              <>
                <label className="field">
                  <span>Name</span>
                  <input
                    className="field-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="dev"
                    autoFocus
                  />
                </label>

                <label className="field">
                  <span>Version</span>
                  <Select.Root key={versions ? 'loaded' : 'loading'} value={version} onValueChange={setVersion} disabled={!versions}>
                    <Select.Trigger className="field-input flex items-center justify-between gap-1 text-left">
                      <Select.Value placeholder="loading…">{version}</Select.Value>
                      <Select.Icon>
                        <ChevronDown size={14} />
                      </Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content
                        position="popper"
                        sideOffset={4}
                        className="bg-bg border border-border rounded-md shadow-lg p-1 z-50 min-w-[var(--radix-select-trigger-width)] max-h-[280px]"
                      >
                        <Select.Viewport>
                          {versions?.map((v) => (
                            <Select.Item
                              key={v}
                              value={v}
                              className="flex items-center justify-between gap-2 px-2 py-1.5 text-[13px] text-fg rounded outline-none cursor-pointer data-[highlighted]:bg-surface data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
                            >
                              <Select.ItemText>{v}</Select.ItemText>
                              <Select.ItemIndicator>
                                <Check size={14} />
                              </Select.ItemIndicator>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                </label>

                <label className="field">
                  <span>Port</span>
                  <input
                    className="field-input"
                    type="number"
                    min={1}
                    max={65535}
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                  />
                </label>
              </>
            )}

            {error && <p className="error-banner">{error}</p>}

            <div className="modal-actions">
              <Dialog.Close asChild>
                <button type="button" className="btn" disabled={submitting}>
                  Cancel
                </button>
              </Dialog.Close>
              <button type="submit" className="btn-primary" disabled={submitting || !versions}>
                Create
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
