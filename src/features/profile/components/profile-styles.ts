import { INPUT_BASE } from '@/features/auth/components/auth-styles'
import { cn } from '@/shared/lib/utils'

/** Profile frame fields: 40px high, 3px radius, visible label above (Figma "Perfil do Colecionador"). */
export const PROFILE_INPUT_CLASS = cn(INPUT_BASE, 'h-10 rounded-[3px] text-body-14')
