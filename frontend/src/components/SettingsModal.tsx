import * as Dialog from '@radix-ui/react-dialog'
import { ExternalLink } from 'lucide-react'
import { useSettings, type Theme } from '@/hooks/useSettings'

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function SettingsModal(props: { onClose: () => void }) {
  const { theme, setTheme, scale, setScale } = useSettings()

  return (
    <Dialog.Root open onOpenChange={(o) => !o && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-backdrop" />
        <Dialog.Content className="modal-wide">
          <Dialog.Title className="modal-title">Settings</Dialog.Title>

          <div className="field">
            <span>Theme</span>
            <div className="flex gap-1">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={theme === t.value ? 'btn-primary flex-1' : 'btn flex-1'}
                  onClick={() => setTheme(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span>UI scale — {Math.round(scale * 100)}%</span>
            <input
              type="range"
              min={0.85}
              max={1.3}
              step={0.05}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="accent-accent"
            />
          </label>

          <div className="border-t border-border pt-3 flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-fg">PG Pilot</span>
            <p className="muted text-[12px] m-0">
              Manage local Postgres instances for development.
            </p>
            <a
              href="https://github.com/ArnabXD/pg-pilot"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-[12px] text-muted hover:text-fg mt-1"
            >
              <ExternalLink size={13} />
              ArnabXD/pg-pilot
            </a>
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
    </Dialog.Root>
  )
}
