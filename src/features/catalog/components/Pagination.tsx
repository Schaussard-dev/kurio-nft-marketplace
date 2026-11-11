import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { stripDefaults } from '../search-params'

const WINDOW = 4

/** Page numbers to render: a sliding window of 4, plus the first/last page with ellipses when out of view. */
function pageItems(page: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= WINDOW + 1) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const start = Math.max(1, Math.min(page - 1, totalPages - WINDOW + 1))
  const items: (number | 'gap')[] = Array.from({ length: WINDOW }, (_, i) => start + i)
  if (start > 1) items.unshift(...(start > 2 ? [1, 'gap' as const] : [1]))
  const end = start + WINDOW - 1
  if (end < totalPages) items.push(...(end < totalPages - 1 ? ['gap' as const, totalPages] : [totalPages]))
  return items
}

const ITEM =
  'inline-flex size-[35px] items-center justify-center rounded-md border border-border-strong text-body-lg-18 text-foreground transition-colors hover:border-primary hover:text-text-accent'

function scrollToCatalog() {
  document.getElementById('catalogo')?.scrollIntoView({ block: 'start' })
}

function PageLink({ page, label, children, current }: { page: number; label: string; children: ReactNode; current?: boolean }) {
  return (
    <Link
      from="/"
      to="/"
      search={(prev) => stripDefaults({ ...prev, page })}
      resetScroll={false}
      onClick={scrollToCatalog}
      aria-label={label}
      aria-current={current ? 'page' : undefined}
      className={cn(ITEM, current && 'border-primary bg-primary font-bold text-ink hover:text-ink')}
    >
      {children}
    </Link>
  )
}

export function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label="Paginação" className="mt-12 flex justify-center md:justify-end">
      <ul className="flex items-center gap-2">
        {page > 1 && (
          <li>
            <PageLink page={page - 1} label="Página anterior">
              <ChevronLeft aria-hidden className="size-5" />
            </PageLink>
          </li>
        )}
        {pageItems(page, totalPages).map((item, index) =>
          item === 'gap' ? (
            <li key={`gap-${index}`} aria-hidden className="px-1 text-text-secondary">
              …
            </li>
          ) : (
            <li key={item}>
              <PageLink page={item} label={`Página ${item}`} current={item === page}>
                {item}
              </PageLink>
            </li>
          ),
        )}
        {page < totalPages && (
          <li>
            <PageLink page={page + 1} label="Próxima página">
              <ChevronRight aria-hidden className="size-5" />
            </PageLink>
          </li>
        )}
      </ul>
    </nav>
  )
}
