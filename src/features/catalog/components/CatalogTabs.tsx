import { Tabs } from 'radix-ui'
import { CATALOG_TABS } from '../search-params'

/** Tab triggers; must render inside the `Tabs.Root` owned by CatalogSection. */
export function CatalogTabs() {
  return (
    <Tabs.List aria-label="Seleção do catálogo" className="-mb-1 flex gap-5 overflow-x-auto pb-1 [scrollbar-width:none]">
      {CATALOG_TABS.map((tab) => (
        <Tabs.Trigger
          key={tab.value}
          value={tab.value}
          className="relative shrink-0 py-1 text-body-14 whitespace-nowrap text-foreground transition-colors hover:text-text-accent data-[state=active]:font-bold data-[state=active]:text-text-accent data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:bottom-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary data-[state=active]:after:content-[''] md:text-body-15 md:font-medium"
        >
          {tab.label}
        </Tabs.Trigger>
      ))}
    </Tabs.List>
  )
}
