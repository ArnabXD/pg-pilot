import { useState } from 'react'
import { Play, Square } from 'lucide-react'
import { Start, Stop, type pg } from '@/services/api'

export function InstanceRow(props: {
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
    <div className={props.open ? 'row-open' : 'row'} onClick={props.onOpen}>
      <span className={inst.running ? 'status-dot-on' : 'status-dot'} />
      <div className="row-name">
        {inst.name}
        <span className="row-path">{inst.dataDir}</span>
      </div>
      <span className="row-version">{inst.version}</span>
      <span className="row-port">{inst.port}</span>
      <span className={inst.running ? 'row-state-on' : 'row-state'}>
        {inst.running ? 'Running' : 'Stopped'}
      </span>
      <button
        className={inst.running ? 'row-toggle-stop' : 'row-toggle-start'}
        onClick={toggle}
        disabled={busy}
      >
        {inst.running ? <Square size={12} /> : <Play size={12} />}
        {inst.running ? 'Stop' : 'Start'}
      </button>
    </div>
  )
}
