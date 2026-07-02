import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Trash2 } from 'lucide-react'
import { DeleteVersion, InstalledVersions, type pg } from '@/services/api'
import { usePoll } from '@/hooks/usePoll'
import { ConfirmDialog } from './ConfirmDialog'

function formatBytes(n: number): string {
  const mb = n / (1024 * 1024)
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`
}

export function ManageVersionsModal(props: { onClose: () => void }) {
  const [versions, refresh] = usePoll<pg.InstalledVersion[] | null>(
    () => InstalledVersions(),
    5000,
    [],
    null,
  )
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  async function handleDelete(version: string) {
    setConfirming(null)
    setDeleting(version)
    setError('')
    try {
      await DeleteVersion(version)
      refresh()
    } catch (e) {
      setError(String(e))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <Dialog.Root open onOpenChange={(o) => !o && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-backdrop" />
        <Dialog.Content className="modal-wide">
          <Dialog.Title className="modal-title">Postgres versions</Dialog.Title>

          {error && <p className="error-banner">{error}</p>}

          <div className="version-list">
            {versions === null && <p className="muted">loading…</p>}
            {versions?.length === 0 && <p className="muted">No versions downloaded yet.</p>}
            {versions?.map((v) => (
              <div className="version-row" key={v.version}>
                <span className="version-name">{v.version}</span>
                <span className="version-size">{formatBytes(v.bytes)}</span>
                {v.inUse ? (
                  <span className="muted text-[11px]">in use</span>
                ) : (
                  <button
                    className="btn-danger"
                    onClick={() => setConfirming(v.version)}
                    disabled={deleting === v.version}
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="modal-actions">
            <Dialog.Close asChild>
              <button type="button" className="btn">
                Close
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>

      {confirming && (
        <ConfirmDialog
          message={`Delete Postgres ${confirming}? This removes the downloaded binaries.`}
          onConfirm={() => handleDelete(confirming)}
          onCancel={() => setConfirming(null)}
        />
      )}
    </Dialog.Root>
  )
}
