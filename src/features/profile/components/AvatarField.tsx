import { ImageUp } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import { toApiError } from '@/shared/api/api-error'
import { Button } from '@/shared/ui/button'
import { validateAvatarFile } from '../avatar'
import { useRemoveAvatar, useSetAvatar } from '../queries'

/** Avatar picker: validates on the client (no request when invalid), resizes to 256 px, then uploads. */
export function AvatarField({ displayName, avatarUrl }: { displayName: string; avatarUrl: string | null }) {
  const labelId = useId()
  const errorId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const setAvatar = useSetAvatar()
  const removeAvatar = useRemoveAvatar()
  const busy = setAvatar.isPending || removeAvatar.isPending

  function onPick(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = ''
    if (!file) return
    const result = validateAvatarFile(file)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setError(null)
    setAvatar.mutate(file, {
      onSuccess: () => toast.success('Avatar atualizado'),
      onError: (e) =>
        setError(toApiError(e).fieldErrors?.dataUrl?.[0] ?? 'Não foi possível enviar a imagem. Tente novamente.'),
    })
  }

  function onRemove() {
    setError(null)
    removeAvatar.mutate(undefined, {
      onSuccess: () => toast.success('Avatar removido'),
      onError: () => setError('Não foi possível remover o avatar. Tente novamente.'),
    })
  }

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-3">
      <span id={labelId} className="text-body-15 text-foreground">
        Avatar
      </span>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex size-[70px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface text-text-accent">
          {avatarUrl ? (
            <img src={avatarUrl} alt={`Avatar de ${displayName}`} className="size-full object-cover" />
          ) : (
            <ImageUp className="size-7" aria-hidden />
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label="Alterar avatar"
          aria-describedby={error ? errorId : undefined}
          hidden
          onChange={(event) => onPick(event.target.files?.[0])}
        />
        <Button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="h-14 px-6">
          {setAvatar.isPending ? 'Enviando…' : 'Alterar'}
        </Button>
        <Button type="button" variant="ghost" disabled={busy || !avatarUrl} onClick={onRemove}>
          Remover
        </Button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-caption-12 text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
