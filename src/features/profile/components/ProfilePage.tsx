import { TriangleAlert } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/Skeleton'
import { useProfile } from '../queries'
import { PasswordForm } from './PasswordForm'
import { ProfileForm } from './ProfileForm'
import { useDocumentTitle } from '@/shared/lib/use-document-title'

/** "Dados do perfil": profile data, avatar and the separate password form. */
export function ProfilePage() {
  useDocumentTitle('Perfil do colecionador')
  const { data, isError, isFetching, refetch } = useProfile()

  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-heading-28 text-foreground">Perfil do colecionador</h1>
      {data ? (
        <ProfileForm profile={data} />
      ) : isError ? (
        <div role="alert" className="flex flex-col items-start gap-4 rounded-lg bg-surface p-6">
          <TriangleAlert aria-hidden className="size-6 text-danger" />
          <p className="text-body-15 font-bold text-foreground">Não foi possível carregar seu perfil.</p>
          <Button onClick={() => void refetch()} disabled={isFetching}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-sm" />
          ))}
        </div>
      )}
      <div className="max-w-xl">
        <PasswordForm />
      </div>
    </div>
  )
}
