import { useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Copy, FolderOpen, Trash2, X } from 'lucide-react'
import { ConnectionString, DeleteInstance, Log, OpenDataDir, type pg } from '@/services/api'
import { usePoll } from '@/hooks/usePoll'
import { ConfirmDialog } from './ConfirmDialog'

export function LogDrawer(props: { instance: pg.InstanceStatus; onClose: () => void }) {
  const { instance } = props
  const [connStr, setConnStr] = useState('')
  const [copied, setCopied] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [height, setHeight] = useState(320)
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null)

  function startResize(e: React.PointerEvent) {
    dragRef.current = { startY: e.clientY, startHeight: height }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onResize(e: React.PointerEvent) {
    if (!dragRef.current) return
    const delta = dragRef.current.startY - e.clientY
    const next = dragRef.current.startHeight + delta
    setHeight(Math.min(Math.max(next, 160), window.innerHeight * 0.9))
  }

  function endResize() {
    dragRef.current = null
  }

  const [log] = usePoll(() => Log(instance.name, 300).catch(() => ''), 2000, [instance.name], '')

  useEffect(() => {
    ConnectionString(instance.name).then(setConnStr).catch(() => {})
  }, [instance.name])

  async function copyConnStr() {
    await navigator.clipboard.writeText(connStr)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function handleDelete() {
    setConfirming(false)
    setDeleting(true)
    try {
      await DeleteInstance(instance.name)
      props.onClose()
    } catch (e) {
      setError(String(e))
      setDeleting(false)
    }
  }

  const closeIfIdle = (o: boolean) => {
    if (!o && !deleting) props.onClose()
  }

  return (
    <Dialog.Root open onOpenChange={closeIfIdle}>
      <Dialog.Portal>
        <Dialog.Content className="drawer" style={{ height }}>
          <Dialog.Title className="sr-only">Logs for {instance.name}</Dialog.Title>
          <Dialog.Description className="sr-only">Postgres log output</Dialog.Description>

          <div
            className="drawer-handle"
            onPointerDown={startResize}
            onPointerMove={onResize}
            onPointerUp={endResize}
          />

          <div className="drawer-header">
            <div className="drawer-title">
              <span className="text-fg">{instance.name}</span>
              {connStr && <span className="conn-inline">{connStr}</span>}
            </div>
            <div className="drawer-actions">
              {connStr && (
                <button className="btn" onClick={copyConnStr}>
                  <Copy size={12} />
                  {copied ? 'Copied' : 'Copy URL'}
                </button>
              )}
              <button className="btn" onClick={() => OpenDataDir(instance.name)}>
                <FolderOpen size={12} />
                Open folder
              </button>
              <button
                className="btn-danger"
                onClick={() => setConfirming(true)}
                disabled={deleting || instance.running}
                title={instance.running ? 'Stop the instance before deleting it' : undefined}
              >
                <Trash2 size={12} />
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
              <Dialog.Close asChild>
                <button type="button" className="icon-btn" aria-label="Close">
                  <X size={14} />
                </button>
              </Dialog.Close>
            </div>
          </div>
          {error && <p className="error-banner">{error}</p>}
          <pre className="drawer-body">{log || 'no log output yet'}</pre>

          {confirming && (
            <ConfirmDialog
              message={`Delete instance "${instance.name}"? This removes its data directory permanently.`}
              onConfirm={handleDelete}
              onCancel={() => setConfirming(false)}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
