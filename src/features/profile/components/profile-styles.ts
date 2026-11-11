import { INPUT_BASE } from '@/features/auth/components/auth-styles'
import { cn } from '@/shared/lib/utils'

/** Profile frame fields: 56px high, small radius, visible label above (Figma "Perfil do Colecionador"). */
export const PROFILE_INPUT_CLASS = cn(INPUT_BASE, 'h-14 rounded-sm text-body-15')
