import { useEffect } from 'react'

/** Names the page in the tab title as "<page> · Kurio" (WCAG 2.4.2) and restores the previous title on unmount. */
export function useDocumentTitle(page: string): void {
  useEffect(() => {
    const previous = document.title
    document.title = `${page} · Kurio`
    return () => {
      document.title = previous
    }
  }, [page])
}
