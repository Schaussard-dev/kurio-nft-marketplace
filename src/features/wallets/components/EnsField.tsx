import { ChevronDown } from 'lucide-react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { AuthField } from '@/features/auth/components/AuthField'
import { PROFILE_INPUT_CLASS } from '@/features/profile/components/profile-styles'
import { ENS_SUFFIX } from '@/shared/lib/ens'
import { cn } from '@/shared/lib/utils'

/** "Nome ENS": the Figma ".eth" selector next to the name; the input holds the name without the suffix. */
export function EnsField({
  id,
  error,
  registration,
}: {
  id: string
  error?: string
  registration: UseFormRegisterReturn
}) {
  return (
    <AuthField id={id} label="Nome ENS" visibleLabel error={error}>
      {(a11y) => (
        <div className="flex gap-3">
          <div className="relative">
            <select
              aria-label="Domínio ENS"
              className={cn(PROFILE_INPUT_CLASS, 'w-28 appearance-none pr-9')}
              defaultValue={ENS_SUFFIX}
            >
              <option value={ENS_SUFFIX}>{ENS_SUFFIX}</option>
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" aria-hidden />
          </div>
          <input {...a11y} {...registration} autoCapitalize="none" className={PROFILE_INPUT_CLASS} />
        </div>
      )}
    </AuthField>
  )
}
