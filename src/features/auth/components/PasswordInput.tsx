import { Eye, EyeOff } from 'lucide-react'
import { useState, type ComponentProps } from 'react'
import { cn } from '@/shared/lib/utils'

/** Password field with a show/hide toggle (Figma eye-off icon inside the field). */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={cn(className, 'pr-12')} />
      <button
        type="button"
        aria-label="Mostrar senha"
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-1 my-auto inline-flex size-9 items-center justify-center rounded-md text-muted hover:text-text-accent"
      >
        {visible ? <Eye className="size-5" aria-hidden /> : <EyeOff className="size-5" aria-hidden />}
      </button>
    </div>
  )
}
