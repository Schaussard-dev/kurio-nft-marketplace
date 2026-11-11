import { useCallback } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { stripDefaults, withFilterChange, type CatalogSearch } from './search-params'

/** Validated catalog search params of `/` (defaults filled in). */
export function useCatalogSearch(): CatalogSearch {
  return useSearch({ from: '/' })
}

interface CatalogNavigateOptions {
  /** Replace the history entry (search typing) instead of pushing (filters, sort, tab, page). */
  replace?: boolean
  /** Keep the current page (pagination itself); every other change goes back to page 1. */
  keepPage?: boolean
}

/** Navigates `/` with a patch of catalog params, keeping the URL free of defaults and the scroll position. */
export function useCatalogNavigate() {
  const navigate = useNavigate({ from: '/' })
  return useCallback(
    (patch: Partial<CatalogSearch>, { replace = false, keepPage = false }: CatalogNavigateOptions = {}) =>
      navigate({
        search: (prev) => stripDefaults(keepPage ? { ...prev, ...patch } : withFilterChange(prev, patch)),
        replace,
        resetScroll: false,
      }),
    [navigate],
  )
}
