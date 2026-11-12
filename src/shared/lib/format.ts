import { type EthString, isEthString } from './money'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function isZero(value: EthString): boolean {
  return /^0*(\.0*)?$/.test(value)
}

export function formatEth(value: EthString, opts: { minDecimals?: number } = {}): string {
  if (!isEthString(value)) {
    throw new TypeError(`Invalid ETH string: "${String(value)}"`)
  }
  const minDecimals = opts.minDecimals ?? 2
  const [intPart, fraction = ''] = value.split('.')
  const trimmed = fraction.replace(/0+$/, '')
  const decimals = trimmed.padEnd(minDecimals, '0')
  return `${intPart}${decimals ? `.${decimals}` : ''} ETH`
}

export function formatDiscount(value: EthString): string {
  return isZero(value) ? '(-) 00.00' : `(-) ${formatEth(value)}`
}

/** Formats an ISO date as "29 Jul, 2026" in UTC (timezone-independent). */
export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`Invalid ISO date: "${iso}"`)
  }
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}, ${date.getUTCFullYear()}`
}

/** "0xa91f…e82c" -> "0xA91F…E82C": lowercase 0x prefix, uppercase hex body. */
export function shortHash(hash: string): string {
  const body = hash.replace(/^0x/i, '').toUpperCase()
  return `0x${body.slice(0, 4)}…${body.slice(-4)}`
}

/** Review rating (0–5, not money) in pt-BR with at most one decimal: 4.75 -> "4,8". */
export function formatRating(rating: number): string {
  return rating.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}
