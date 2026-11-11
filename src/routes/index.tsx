import { createFileRoute } from '@tanstack/react-router'
import { artSources } from '@/features/catalog/art'
import { Button } from '@/shared/ui/button'

export const Route = createFileRoute('/')({
  component: HomePage,
})

// Placeholder built only from design tokens; Task 10 replaces it with the real page.
function HomePage() {
  const art = artSources('emerald')
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-4">
      <h1 className="text-display text-foreground">Kurio</h1>
      <p className="text-body-lg-16 text-text-secondary">Marketplace de NFTs</p>
      <picture>
        <source type="image/avif" srcSet={art.srcSet.avif} sizes="320px" />
        <source type="image/webp" srcSet={art.srcSet.webp} sizes="320px" />
        <img src={art.webp} alt="" width={320} height={320} className="rounded-lg border border-border" />
      </picture>
      <div className="flex gap-3">
        <Button>Adicionar ao carrinho</Button>
        <Button variant="outline">Favoritar</Button>
      </div>
    </main>
  )
}
