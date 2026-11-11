import { Link, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'

export const APP_NAME = 'Kurio'

function NotFound() {
  return (
    <main>
      <h1>Página não encontrada</h1>
      <Link to="/">Voltar para o início</Link>
    </main>
  )
}

export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: NotFound,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
