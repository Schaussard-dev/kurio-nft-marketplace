import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

export type Politeness = 'polite' | 'assertive'
type Announce = (message: string, politeness?: Politeness) => void

const LiveRegionContext = createContext<Announce | null>(null)

/** Renders two visually hidden live regions and exposes `announce` to the tree. */
export function LiveRegionProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState('')
  const [assertive, setAssertive] = useState('')
  const timers = useRef<{ polite?: number; assertive?: number }>({})

  const announce = useCallback<Announce>((message, politeness = 'polite') => {
    const set = politeness === 'assertive' ? setAssertive : setPolite
    window.clearTimeout(timers.current[politeness])
    // Clearing first makes screen readers re-announce an identical message.
    set('')
    timers.current[politeness] = window.setTimeout(() => set(message), 50)
  }, [])

  const value = useMemo(() => announce, [announce])

  return (
    <LiveRegionContext.Provider value={value}>
      {children}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="live-polite">
        {polite}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true" data-testid="live-assertive">
        {assertive}
      </div>
    </LiveRegionContext.Provider>
  )
}

export function useAnnounce(): Announce {
  const announce = useContext(LiveRegionContext)
  if (!announce) throw new Error('useAnnounce must be used inside LiveRegionProvider')
  return announce
}
