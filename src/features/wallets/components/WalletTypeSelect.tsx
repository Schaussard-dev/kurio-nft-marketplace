import type { UseFormRegisterReturn } from 'react-hook-form'
import { SelectField } from './SelectField'

const WALLET_TYPE_OPTIONS = [
  { value: 'metamask', label: 'MetaMask' },
  { value: 'walletconnect', label: 'WalletConnect' },
  { value: 'coinbase', label: 'Coinbase Wallet' },
] as const

export function WalletTypeSelect({
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
      label="Tipo de carteira"
      placeholder="Selecione uma carteira"
      options={WALLET_TYPE_OPTIONS}
      error={error}
      registration={registration}
    />
  )
}
