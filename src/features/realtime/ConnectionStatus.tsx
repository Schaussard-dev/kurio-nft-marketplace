import { CircleCheck, LoaderCircle, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSocketStatus } from './use-socket-status'

/** Short drops (flaps) stay silent: the pill only shows when the outage lasts this long. */
const SHOW_DELAY_MS = 1500
const RESTORED_MS = 3000

type Phase = 'hidden' | 'down' | 'restored'

/**
 * Header pill for the realtime connection. The `role="status"` wrapper is always mounted so screen
 * readers hear "Reconectando…" once per real outage and "Conexão restabelecida" when it ends.
 */
export function ConnectionStatus() {
  const status = useSocketStatus()
  const [phase, setPhase] = useState<Phase>('hidden')
  const [seenStatus, setSeenStatus] = useState(status)

  // Adjust the phase while rendering when the status changes (no extra effect pass).
  if (status !== seenStatus) {
    setSeenStatus(status)
    if (status === 'connected' && phase === 'down') setPhase('restored')
    if (status !== 'connected' && phase === 'restored') setPhase('hidden')
  }

  useEffect(() => {
    if (status !== 'connected' && phase === 'hidden') {
      const timer = window.setTimeout(() => setPhase('down'), SHOW_DELAY_MS)
      return () => window.clearTimeout(timer)
    }
    if (phase === 'restored') {
      const timer = window.setTimeout(() => setPhase('hidden'), RESTORED_MS)
      return () => window.clearTimeout(timer)
    }
  }, [status, phase])

  let content = null
  if (phase === 'down') {
    const offline = status === 'offline'
    const Icon = offline ? WifiOff : LoaderCircle
    content = (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/60 bg-primary/10 px-2.5 py-1 text-caption-13 whitespace-nowrap text-foreground">
        <Icon aria-hidden className={offline ? 'size-4 text-text-accent' : 'size-4 text-text-accent motion-safe:animate-spin'} />
        {offline ? 'Sem conexão' : 'Reconectando…'}
      </span>
    )
  } else if (phase === 'restored') {
    content = (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-2.5 py-1 text-caption-13 whitespace-nowrap text-text-secondary">
        <CircleCheck aria-hidden className="size-4 text-text-accent" />
        Conexão restabelecida
      </span>
    )
  }

  return (
    <span role="status" data-testid="socket-status" data-status={status} className="inline-flex">
      {content}
    </span>
  )
}
