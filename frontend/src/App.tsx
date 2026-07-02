import { useState } from 'react'
import { Database, PackageOpen, Plus, Settings } from 'lucide-react'
import { Status, type pg } from '@/services/api'
import { usePoll } from '@/hooks/usePoll'
import { InstanceRow } from '@/components/InstanceRow'
import { LogDrawer } from '@/components/LogDrawer'
import { CreateInstanceModal } from '@/components/CreateInstanceModal'
import { ManageVersionsModal } from '@/components/ManageVersionsModal'
import { SettingsModal } from '@/components/SettingsModal'

function App() {
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [managingVersions, setManagingVersions] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [error, setError] = useState('')

  const [instances, refresh] = usePoll<pg.InstanceStatus[] | null>(
    () =>
      Status().catch((e) => {
        setError(String(e))
        return null
      }),
    3000,
    [],
    null,
  )

  const selectedInstance = instances?.find((i) => i.name === selected) ?? null

  return (
    <div id="app" className="h-screen flex flex-col font-sans text-[13px]">
      <div className="topbar">
        <div className="flex items-baseline gap-2">
          <h1 className="text-[14px] font-semibold text-fg inline m-0 tracking-tight">PG Pilot</h1>
          {instances && (
            <span className="text-[11px] text-muted font-normal opacity-70">
              {instances.length} instance{instances.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <button className="icon-btn" title="Manage Postgres versions" onClick={() => setManagingVersions(true)}>
            <PackageOpen size={15} />
          </button>
          <button className="icon-btn" title="New instance" onClick={() => setCreating(true)}>
            <Plus size={15} />
          </button>
          <button className="icon-btn" title="Settings" onClick={() => setSettingsOpen(true)}>
            <Settings size={15} />
          </button>
        </div>
      </div>

      {error && <p className="error-banner">{error}</p>}

      {instances && instances.length > 0 && (
        <div className="col-head">
          <span className="invisible">•</span>
          <span>Name</span>
          <span>Version</span>
          <span>Port</span>
          <span>State</span>
          <span></span>
        </div>
      )}

      <div id="list" className="flex-1 overflow-y-auto min-h-0">
        {instances === null && <p className="muted text-center pt-10">loading…</p>}
        {instances?.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="empty-icon">
              <Database size={20} />
            </div>
            <div className="flex flex-col items-center gap-1">
              <p className="empty-title">No Postgres instances yet</p>
              <p className="empty-desc">Create one to get a local database running in seconds.</p>
            </div>
            <button className="btn-primary mt-1" onClick={() => setCreating(true)}>
              <Plus size={14} />
              Create your first instance
            </button>
          </div>
        )}
        {instances?.map((inst) => (
          <InstanceRow
            key={inst.name}
            inst={inst}
            open={selected === inst.name}
            onOpen={() => setSelected(selected === inst.name ? null : inst.name)}
            onChange={refresh}
            onError={setError}
          />
        ))}
      </div>

      {selectedInstance && <LogDrawer instance={selectedInstance} onClose={() => setSelected(null)} />}

      {creating && (
        <CreateInstanceModal
          existingPorts={instances?.map((i) => i.port) ?? []}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            refresh()
          }}
        />
      )}

      {managingVersions && <ManageVersionsModal onClose={() => setManagingVersions(false)} />}

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

export default App
