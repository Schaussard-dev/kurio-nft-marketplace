import { CircleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

export interface FieldA11y {
  id: string
  'aria-invalid': boolean
  'aria-required'?: boolean
  'aria-describedby'?: string
}

/**
 * Figma draws placeholders only, so the label is visually hidden but real. The error sits under
 * the field (icon + text, never color alone) and is wired through aria-describedby/aria-invalid.
 * Required fields (all of them here) say "obrigatório" in the label and set aria-required (spec §10).
 */
export function AuthField({
  id,
  label,
  error,
  required = true,
  children,
}: {
  id: string
  label: string
  error?: string
  required?: boolean
  children: (a11y: FieldA11y) => ReactNode
}) {
  const errorId = `${id}-erro`
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="sr-only">
        {label}
        {required && ' (obrigatório)'}
      </label>
      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-required': required || undefined,
        'aria-describedby': error ? errorId : undefined,
      })}
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-caption-12 text-danger">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3 text-caption-13 text-foreground">
      <span className="h-px flex-1 bg-border" aria-hidden />
      Ou continue com
      <span className="h-px flex-1 bg-border" aria-hidden />
    </div>
  )
}
