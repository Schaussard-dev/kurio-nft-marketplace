import { Link } from '@tanstack/react-router'
import { buttonVariants } from '@/shared/ui/button'

export function NotFound() {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-start gap-4 py-20">
      <h1 className="text-display-32 text-foreground">Página não encontrada</h1>
      <p className="text-body-lg-16 text-text-secondary">
        O endereço que você abriu não existe ou foi movido.
      </p>
      <Link to="/" className={buttonVariants()}>
        Voltar ao início
      </Link>
    </section>
  )
}
