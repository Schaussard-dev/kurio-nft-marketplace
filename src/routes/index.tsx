import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { HomeContent } from '@/features/catalog/components/HomeContent'
import { CATALOG_DEFAULTS, catalogSearchSchema } from '@/features/catalog/search-params'

export const Route = createFileRoute('/')({
  validateSearch: catalogSearchSchema,
  // Links and navigations never write default values (tab=all, sort=recent, page=1) to the URL.
  search: { middlewares: [stripSearchParams(CATALOG_DEFAULTS)] },
  component: HomeContent,
})
