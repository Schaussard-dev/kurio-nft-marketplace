import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { Fragment } from 'react'

export interface BreadcrumbItem {
  label: string
  /** Omit on the current page (last item). */
  to?: '/' | '/carrinho' | '/perfil'
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Trilha de navegação" className="text-body-14 text-text-secondary">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <Fragment key={item.label}>
            {i > 0 && <ChevronRight className="size-3.5" aria-hidden />}
            <li>
              {item.to ? (
                <Link to={item.to} className="hover:text-text-accent">
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page" className="text-foreground">
                  {item.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}
