import { z } from 'zod'
import {
  WALLET_ADDRESS_ERROR,
  WALLET_ENS_REQUIRED_ERROR,
  WALLET_SECONDARY_ERROR,
  emailSchema,
  isValidSecondaryWallet,
  isValidWalletAddress,
  networkSchema,
  type CreateOrderInput,
  type Network,
  type Profile,
  type Quote,
  type Wallet,
  type WalletsResponse,
} from '@/shared/contracts'
import { ENS_LABEL_ERROR, ENS_LABEL_PATTERN, toFormEns, toStoredEns } from '@/shared/lib/ens'
import { CONNECTORS, MANUAL_WALLET, type CheckoutDraft, type Connector } from './draft'

const REQUIRED = 'Campo obrigatório'
const required = z.string().trim().min(1, REQUIRED)

export const NOTE_MAX = 500

/** /pagamento form: every `*` field of the Figma frame is required; the draft has the same shape. */
export const checkoutFormSchema = z
  .object({
    displayName: required,
    username: required,
    network: z.union([networkSchema, z.literal('')]),
    profileName: required,
    walletAddress: required,
    secondaryAddress: z.string().trim(),
    connector: z.union([z.enum(CONNECTORS), z.literal('')]),
    referralCode: required,
    email: z.string().trim().min(1, REQUIRED).pipe(emailSchema),
    ensName: z.string().trim().regex(ENS_LABEL_PATTERN, ENS_LABEL_ERROR),
    walletChoice: z.string().min(1, 'Escolha uma carteira'),
    note: z.string().max(NOTE_MAX, `Use até ${NOTE_MAX} caracteres`),
  })
  .superRefine((value, ctx) => {
    if (!value.connector) ctx.addIssue({ code: 'custom', path: ['connector'], message: 'Selecione uma carteira' })
    if (!value.network) {
      ctx.addIssue({ code: 'custom', path: ['network'], message: 'Selecione uma rede' })
      return
    }
    if (value.walletAddress && !isValidWalletAddress(value.network, value.walletAddress.trim())) {
      ctx.addIssue({ code: 'custom', path: ['walletAddress'], message: WALLET_ADDRESS_ERROR })
    }
    if (value.secondaryAddress && !isValidSecondaryWallet(value.network, value.secondaryAddress.trim())) {
      ctx.addIssue({ code: 'custom', path: ['secondaryAddress'], message: WALLET_SECONDARY_ERROR })
    }
    // Same rule as the wallet form: the ENS name is optional outside Ethereum (spec §9).
    if (value.network === 'ethereum' && !value.ensName.trim()) {
      ctx.addIssue({ code: 'custom', path: ['ensName'], message: WALLET_ENS_REQUIRED_ERROR })
    }
  })

export type CheckoutFormValues = Omit<CheckoutDraft, 'knownWalletIds'>

/** DOM order of the fields; the first invalid one gets the focus. */
export const FIELD_ORDER = [
  'walletChoice',
  'displayName',
  'username',
  'network',
  'profileName',
  'walletAddress',
  'secondaryAddress',
  'connector',
  'referralCode',
  'email',
  'ensName',
  'note',
] as const satisfies readonly (keyof CheckoutFormValues)[]

export const NETWORK_LABELS: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

/** Mobile frame copy: "Rede principal Ethereum", "Rede Polygon". */
export function networkCaption(network: Network): string {
  return network === 'ethereum' ? 'Rede principal Ethereum' : `Rede ${NETWORK_LABELS[network]}`
}

export const CONNECTOR_LABELS: Record<Connector, string> = {
  metamask: 'MetaMask',
  walletconnect: 'WalletConnect',
  coinbase: 'Coinbase Wallet',
}

export function registeredWallets(wallets: WalletsResponse | undefined): Wallet[] {
  return [wallets?.primary, wallets?.secondary].filter((w): w is Wallet => Boolean(w))
}

/** The wallet-derived fields a registered wallet fills in (and keeps read-only while selected). */
export function walletFields(wallet: Wallet) {
  return {
    network: wallet.network,
    walletAddress: wallet.address,
    secondaryAddress: wallet.secondaryAddress ?? '',
    connector: wallet.walletType,
    ensName: toFormEns(wallet.ensName),
  } satisfies Partial<CheckoutFormValues>
}

/**
 * Initial values: the saved draft (after a session expiry) when it still points at a known wallet,
 * otherwise profile + primary wallet (spec §9), or manual entry when no wallet is registered.
 */
export function initialValues(
  profile: Profile,
  wallets: WalletsResponse,
  draft: CheckoutDraft | null,
): CheckoutFormValues {
  const registered = registeredWallets(wallets)
  if (draft) {
    const { knownWalletIds, ...values } = draft
    // The drafted wallet still exists: its current fields win over what the draft copied.
    const drafted = registered.find((w) => w.id === values.walletChoice)
    if (drafted) return { ...values, ...walletFields(drafted) }
    // Back from "Cadastrar carteira": a wallet created after the draft is the one to pay with.
    const created = registered.find((w) => !knownWalletIds.includes(w.id))
    if (values.walletChoice === MANUAL_WALLET && !created) return values
    const next = created ?? registered[0]
    if (next) return { ...values, ...walletFields(next), walletChoice: next.id }
    return { ...values, walletChoice: MANUAL_WALLET }
  }
  const wallet = registered[0]
  const base: CheckoutFormValues = {
    displayName: profile.displayName,
    username: profile.username,
    network: '',
    profileName: profile.username,
    walletAddress: '',
    secondaryAddress: '',
    connector: '',
    referralCode: '',
    email: profile.email,
    ensName: toFormEns(profile.ensName),
    walletChoice: MANUAL_WALLET,
    note: '',
  }
  if (!wallet) return base
  return {
    ...base,
    displayName: wallet.displayName,
    profileName: wallet.profileName,
    referralCode: wallet.referralCode,
    email: wallet.email,
    ...walletFields(wallet),
    walletChoice: wallet.id,
  }
}

/** Order payload from valid form values and the quote the collector reviewed. */
export function toOrderInput(values: CheckoutFormValues, quoteId: string): CreateOrderInput {
  const ensName = toStoredEns(values.ensName)
  const secondaryAddress = values.secondaryAddress.trim()
  const note = values.note.trim()
  return {
    quoteId,
    connector: values.connector as Connector,
    walletId: values.walletChoice === MANUAL_WALLET ? null : values.walletChoice,
    network: values.network as Network,
    payer: {
      displayName: values.displayName.trim(),
      username: values.username.trim(),
      profileName: values.profileName.trim(),
      email: values.email.trim(),
      ...(ensName && { ensName }),
      referralCode: values.referralCode.trim(),
      walletAddress: values.walletAddress.trim(),
      ...(secondaryAddress && { secondaryAddress }),
    },
    ...(note && { note }),
  }
}

/** Where the connect request goes: a registered wallet id, or the connector id for a manual wallet. */
export function connectTarget(values: Pick<CheckoutFormValues, 'walletChoice' | 'connector'>): string {
  return values.walletChoice === MANUAL_WALLET ? values.connector : values.walletChoice
}

/** "0xA91F…E82C" (EVM) or "7xKX…AsUq" (Solana). */
export function shortAddress(address: string): string {
  if (/^0x/i.test(address)) {
    const body = address.slice(2).toUpperCase()
    return `0x${body.slice(0, 4)}…${body.slice(-4)}`
  }
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

export function walletTitle(wallet: Wallet): string {
  return wallet.nickname || (wallet.slot === 'primary' ? 'Carteira principal' : 'Carteira secundária')
}

export interface LineChange {
  lineId: string
  name: string
  before: string | null
  after: string | null
}

/** A renewed quote with the same lines and total: nothing for the collector to confirm again. */
export function isUnchangedQuote(previous: Quote, next: Quote): boolean {
  return changedLines(previous, next, {}).length === 0 && previous.total === next.total
}

/** Lines whose unit price, quantity or presence differ between two quotes (QUOTE_STALE dialog). */
export function changedLines(previous: Quote, next: Quote, names: Record<string, string>): LineChange[] {
  const ids = [...new Set([...previous.lines, ...next.lines].map((line) => line.lineId))]
  return ids.flatMap((lineId) => {
    const before = previous.lines.find((line) => line.lineId === lineId)
    const after = next.lines.find((line) => line.lineId === lineId)
    if (before && after && before.unitPrice === after.unitPrice && before.quantity === after.quantity) return []
    const nftId = (after ?? before)!.nftId
    return [{ lineId, name: names[lineId] ?? nftId, before: before?.unitPrice ?? null, after: after?.unitPrice ?? null }]
  })
}
