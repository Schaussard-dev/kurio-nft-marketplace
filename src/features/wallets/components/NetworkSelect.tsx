import type { UseFormRegisterReturn } from 'react-hook-form'
import { SelectField } from './SelectField'

const NETWORK_OPTIONS = [
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'polygon', label: 'Polygon' },
  { value: 'solana', label: 'Solana' },
] as const

export function NetworkSelect({
  id,
  error,
  registration,
}: {
  id: string
  error?: string
  registration: UseFormRegisterReturn
}) {
  return (
    <SelectField
      id={id}
      label="Rede"
      placeholder="Selecione uma rede"
      options={NETWORK_OPTIONS}
      error={error}
      registration={registration}
    />
  )
}
