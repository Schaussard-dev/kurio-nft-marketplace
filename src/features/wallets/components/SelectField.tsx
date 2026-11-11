import { ChevronDown } from 'lucide-react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { AuthField } from '@/features/auth/components/AuthField'
import { PROFILE_INPUT_CLASS } from '@/features/profile/components/profile-styles'
import { cn } from '@/shared/lib/utils'

export interface SelectFieldProps {
  id: string
  label: string
  placeholder: string
  options: readonly { value: string; label: string }[]
  error?: string
  registration: UseFormRegisterReturn
}

/** Native select (real keyboard and screen-reader behavior) styled like the Figma dropdowns. */
export function SelectField({ id, label, placeholder, options, error, registration }: SelectFieldProps) {
  return (
    <AuthField id={id} label={label} visibleLabel error={error}>
      {(a11y) => (
        <div className="relative">
          <select {...a11y} {...registration} className={cn(PROFILE_INPUT_CLASS, 'appearance-none pr-10')}>
            <option value="">{placeholder}</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2" aria-hidden />
        </div>
      )}
    </AuthField>
  )
}
