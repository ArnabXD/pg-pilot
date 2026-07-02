import { useEffect, useState } from 'react'
import { EventsOn } from '../wailsjs/runtime/runtime'
import {
  AvailableVersions,
  ConnectionString,
  CreateInstance,
  DeleteInstance,
  Log,
  OpenDataDir,
  Start,
  Status,
  Stop,
} from '../wailsjs/go/main/App'
import type { pg } from '../wailsjs/go/models'
import './App.css'

function App() {
  const [instances, setInstances] = useState<pg.InstanceStatus[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 3000)
    return () => clearInterval(id)
  }, [])

  async function refresh() {
    try {
      const list = await Status()
      setInstances(list)
    } catch (e) {
      setError(String(e))
    }
  }

  const selectedInstance = instances?.find((i) => i.name === selected) ?? null

  return (
    <div id="app">
      <div id="topbar">
        <div>
          <h1>pg-pilot</h1>
          {instances && <span className="count">{instances.length} instance{instances.length === 1 ? '' : 's'}</span>}
        </div>
        <button className="icon-btn" title="New instance" onClick={() => setCreating(true)}>
          +
        </button>
      </div>

      {error && <p className="error banner">{error}</p>}

      {instances && instances.length > 0 && (
        <div className="col-head">
          <span>•</span>
          <span>Name</span>
          <span>Version</span>
          <span>Port</span>
          <span>State</span>
          <span></span>
        </div>
      )}

      <div id="list">
        {instances === null && <p className="muted center-pad">loading…</p>}
        {instances?.length === 0 && (
          <div className="empty-state">
            <p>No Postgres instances yet.</p>
            <button className="btn primary" onClick={() => setCreating(true)}>
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

      {selectedInstance && (
        <LogDrawer instance={selectedInstance} onClose={() => setSelected(null)} />
      )}

      {creating && (
        <CreateInstanceModal
          existingPorts={instances?.map((i) => i.port) ?? []}
          onClose={() => setCreating(false)}
          onCreated={async () => {
            setCreating(false)
            await refresh()
          }}
        />
      )}
    </div>
  )
}

function InstanceRow(props: {
  inst: pg.InstanceStatus
  open: boolean
  onOpen: () => void
  onChange: () => void
  onError: (e: string) => void
}) {
  const { inst } = props
  const [busy, setBusy] = useState(false)

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation()
    setBusy(true)
    try {
      if (inst.running) {
        await Stop(inst.name)
      } else {
        await Start(inst.name)
      }
      await props.onChange()
    } catch (err) {
      props.onError(String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`row ${props.open ? 'drawer-open' : ''}`} onClick={props.onOpen}>
      <span className={`status-dot ${inst.running ? 'on' : ''}`} />
      <div className="row-name">
        {inst.name}
        <span className="path">{inst.dataDir}</span>
      </div>
      <span className="row-version">{inst.version}</span>
      <span className="row-port">{inst.port}</span>
      <span className={`row-state ${inst.running ? 'on' : 'off'}`}>
        {inst.running ? 'Running' : 'Stopped'}
      </span>
      <button
        className={`row-toggle ${inst.running ? 'stop' : 'start'}`}
        onClick={toggle}
        disabled={busy}
      >
        {inst.running ? 'Stop' : 'Start'}
      </button>
    </div>
  )
}

function LogDrawer(props: { instance: pg.InstanceStatus; onClose: () => void }) {
  const { instance } = props
  const [log, setLog] = useState('')
  const [connStr, setConnStr] = useState('')
  const [copied, setCopied] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    ConnectionString(instance.name).then(setConnStr).catch(() => {})
  }, [instance.name])

  useEffect(() => {
    const fetchLog = () => Log(instance.name, 300).then(setLog).catch(() => {})
    fetchLog()
    const id = setInterval(fetchLog, 2000)
    return () => clearInterval(id)
  }, [instance.name])

  async function copyConnStr() {
    await navigator.clipboard.writeText(connStr)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function handleDelete() {
    if (instance.running) {
      setError('Stop the instance before deleting it.')
      return
    }
    if (!confirm(`Delete instance "${instance.name}"? This removes its data directory permanently.`)) {
      return
    }
    setDeleting(true)
    try {
      await DeleteInstance(instance.name)
      props.onClose()
    } catch (e) {
      setError(String(e))
      setDeleting(false)
    }
  }

  return (
    <div id="drawer">
      <div id="drawer-header">
        <div id="drawer-title">
          <span>{instance.name}</span>
          {connStr && <span className="conn-inline">{connStr}</span>}
        </div>
        <div id="drawer-actions">
          {connStr && <button onClick={copyConnStr}>{copied ? 'Copied' : 'Copy URL'}</button>}
          <button onClick={() => OpenDataDir(instance.name)}>Open folder</button>
          <button onClick={handleDelete} disabled={deleting} className="danger">
            Delete
          </button>
          <button className="close" onClick={props.onClose} aria-label="Close">
            ✕
          </button>
        </div>
      </div>
      {error && <p className="error drawer-error">{error}</p>}
      <pre id="drawer-body">{log || 'no log output yet'}</pre>
    </div>
  )
}

function CreateInstanceModal(props: {
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

  return (
    <div className="modal-backdrop" onClick={() => !submitting && props.onClose()}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>New instance</h2>

        {submitting ? (
          <p className="muted">{progress || 'working…'}</p>
        ) : (
          <>
            <label className="field">
              <span>Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="dev"
                autoFocus
              />
            </label>

            <label className="field">
              <span>Version</span>
              <select value={version} onChange={(e) => setVersion(e.target.value)} disabled={!versions}>
                {versions
                  ? versions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))
                  : <option>loading…</option>}
              </select>
            </label>

            <label className="field">
              <span>Port</span>
              <input
                type="number"
                min={1}
                max={65535}
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
              />
            </label>
          </>
        )}

        {error && <p className="error">{error}</p>}

        <div className="modal-actions">
          <button type="button" onClick={props.onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={submitting || !versions}>
            Create
          </button>
        </div>
      </form>
    </div>
  )
}

export default App
