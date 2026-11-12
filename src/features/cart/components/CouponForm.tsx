import { CircleAlert, TicketPercent, X } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { cn } from '@/shared/lib/utils'
import { useAnnounce } from '@/shared/ui/LiveRegion'
import { parseCouponParam } from '../coupon-param'

interface CouponFormProps {
  /** Code in the URL (`?cupom=`), applied or not. */
  code: string | undefined
  /** Coupon accepted by the API quote (shown as applied, with a remove button). */
  applied: { code: string; percent: number } | null
  /** API error for `code` (e.g. "Cupom inválido"), associated with the input. */
  error: string | undefined
  /** The quote for `code` is still loading. */
  checking: boolean
  onApply: (code: string) => void
  onRemove: () => void
  variant: 'desktop' | 'mobile'
}

const EMPTY_ERROR = 'Digite o código promocional'
const FORMAT_ERROR = 'Cupom inválido'

/**
 * "Código promocional" (Figma): the code lives in the URL; the quote validates it and its error is tied
 * to the input (aria-invalid + aria-describedby). Re-keyed by the page when the URL code changes.
 */
export function CouponForm({ code, applied, error, checking, onApply, onRemove, variant }: CouponFormProps) {
  const [value, setValue] = useState(code ?? '')
  const [localError, setLocalError] = useState<string>()
  const inputId = useId()
  const errorId = useId()
  const shownError = localError ?? error
  const mobile = variant === 'mobile'
  const announce = useAnnounce()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    // Malformed codes (spaces, symbols, > 32 chars) never reach the URL or the API.
    const next = parseCouponParam(value)
    if (!next) {
      const message = value.trim() ? FORMAT_ERROR : EMPTY_ERROR
      setLocalError(message)
      announce(message, 'assertive')
      return
    }
    setLocalError(undefined)
    onApply(next)
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Cupom" className="flex flex-col gap-2">
      <label htmlFor={inputId} className={cn('text-body-14 font-bold text-foreground', mobile && 'sr-only')}>
        Código promocional
      </label>
      <div
        className={cn(
          'flex items-stretch overflow-hidden border',
          shownError ? 'border-danger' : 'border-border-strong focus-within:border-primary',
          mobile ? 'h-[52px] rounded-full bg-ink/30' : 'h-10 rounded-xs',
        )}
      >
        <input
          id={inputId}
          name="cupom"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setLocalError(undefined)
          }}
          placeholder="Digite o código promocional..."
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={shownError ? errorId : undefined}
          className={cn(
            'min-w-0 flex-1 bg-transparent text-body-14 text-foreground placeholder:text-muted focus-visible:-outline-offset-2',
            mobile ? 'px-5 text-caption-13' : 'px-3',
          )}
        />
        <button
          type="submit"
          aria-busy={checking || undefined}
          className={cn(
            'shrink-0 px-5 text-body-15 font-bold text-ink transition-opacity hover:opacity-90',
            mobile ? 'w-[97px] rounded-full bg-gradient-to-r from-primary-dark to-primary-light px-0' : 'bg-primary',
          )}
        >
          Aplicar
        </button>
      </div>
      {shownError && (
        <p id={errorId} className="flex items-center gap-1.5 text-caption-13 text-danger">
          <CircleAlert aria-hidden className="size-4 shrink-0" />
          {shownError}
        </p>
      )}
      {applied && !shownError && (
        <p className="flex items-center justify-between gap-2 text-body-14 text-success">
          <span className="flex items-center gap-1.5">
            <TicketPercent aria-hidden className="size-4" />
            Cupom {applied.code} aplicado ({applied.percent}% de desconto)
          </span>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remover cupom ${applied.code}`}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-text-accent hover:bg-surface-2"
          >
            <X aria-hidden className="size-4" />
            Remover
          </button>
        </p>
      )}
      {code && shownError && !localError && (
        <button type="button" onClick={onRemove} className="self-start text-caption-13 text-text-accent underline-offset-4 hover:underline">
          Limpar cupom
        </button>
      )}
    </form>
  )
}
