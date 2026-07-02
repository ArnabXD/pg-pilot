// Thin re-export over Wails-generated bindings. Components import from here so
// the UI never touches `wailsjs/` paths directly.
export {
  AvailableVersions,
  ConnectionString,
  CreateInstance,
  DeleteInstance,
  DeleteVersion,
  InstalledVersions,
  Log,
  OpenDataDir,
  Start,
  Status,
  Stop,
} from '../../wailsjs/go/main/App'

export { EventsOn } from '../../wailsjs/runtime/runtime'

export type { pg } from '../../wailsjs/go/models'
