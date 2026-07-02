import { useEffect, useRef, useState } from 'react'

export function usePoll<T>(fetcher: () => Promise<T>, intervalMs: number, deps: unknown[], initial: T): [T, () => void] {
  const [value, setValue] = useState<T>(initial)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    let cancelled = false
    const tick = () => fetcherRef.current().then((v) => !cancelled && setValue(v))
    tick()
    const id = setInterval(tick, intervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return [value, () => fetcherRef.current().then(setValue)]
}