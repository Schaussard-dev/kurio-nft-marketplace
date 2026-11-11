import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useCatalogNavigate, useCatalogSearch } from '../use-catalog-search'

const DEBOUNCE_MS = 300

interface Draft {
  /** What is in the input. */
  value: string
  /** URL `q` the draft was last reconciled with. */
  base: string
  /** Last `q` this field navigated to (its own URL updates must not overwrite typing). */
  sent: string
}

/**
 * Catalog search input (`#catalogo-busca`, focused by the header search button).
 * Typing updates the URL after 300 ms with `replace`, so history keeps one entry per search.
 */
export function CatalogSearchField({ variant, className }: { variant: 'sidebar' | 'bar'; className?: string }) {
  const urlQ = useCatalogSearch().q ?? ''
  const navigateCatalog = useCatalogNavigate()
  const [draft, setDraft] = useState<Draft>({ value: urlQ, base: urlQ, sent: urlQ })

  // The URL changed outside this field (back/forward, "Limpar filtros"): adopt it.
  let current = draft
  if (urlQ !== draft.base) {
    current = urlQ === draft.sent ? { ...draft, base: urlQ } : { value: urlQ, base: urlQ, sent: urlQ }
    setDraft(current)
  }
  const value = current.value

  useEffect(() => {
    const next = value.trim()
    if (next === urlQ) return
    const timer = window.setTimeout(() => {
      setDraft((d) => ({ ...d, sent: next }))
      void navigateCatalog({ q: next || undefined }, { replace: true })
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [value, urlQ, navigateCatalog])

  return (
    <div className={cn('relative', className)} role="search">
      <label htmlFor="catalogo-busca" className="sr-only">
        Buscar NFTs
      </label>
      <Search
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted',
          variant === 'bar' ? 'left-3.5 size-5' : 'left-3 size-4',
        )}
      />
      <input
        id="catalogo-busca"
        type="search"
        autoComplete="off"
        enterKeyHint="search"
        placeholder={variant === 'bar' ? 'Explorar coleções' : 'Buscar NFTs'}
        value={value}
        onChange={(event) => setDraft((d) => ({ ...d, value: event.target.value }))}
        className={cn(
          'w-full bg-surface text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-primary',
          variant === 'bar'
            ? 'h-[45px] rounded-xl pr-3 pl-11 text-body-14 font-bold'
            : 'h-10 rounded-md border border-border-strong bg-ink pr-3 pl-9 text-body-14',
        )}
      />
    </div>
  )
}
