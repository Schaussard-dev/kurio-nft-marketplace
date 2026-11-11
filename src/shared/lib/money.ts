import Big from 'big.js'

/** Decimal ETH amount as a string, e.g. "26.846". Never convert to Number for math. */
export type EthString = string

// Local constructor clone so the global Big config is never mutated.
const B = Big()
B.DP = 18
B.RM = Big.roundHalfUp
B.PE = 1_000_000
B.NE = -1_000_000

const ETH_STRING_PATTERN = /^\d+(\.\d{1,18})?$/

export function isEthString(s: string): boolean {
  return typeof s === 'string' && ETH_STRING_PATTERN.test(s)
}

function parse(value: EthString): Big {
  if (!isEthString(value)) {
    throw new TypeError(`Invalid ETH string: "${String(value)}"`)
  }
  return new B(value)
}

function canonical(value: Big): EthString {
  const fixed = value.toFixed()
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed
}

export function add(a: EthString, b: EthString): EthString {
  return canonical(parse(a).plus(parse(b)))
}

export function sub(a: EthString, b: EthString): EthString {
  return canonical(parse(a).minus(parse(b)))
}

export function mul(a: EthString, qty: number): EthString {
  return canonical(parse(a).times(qty))
}

export function percentOf(a: EthString, pct: number): EthString {
  return canonical(parse(a).times(pct).div(100))
}

export function compare(a: EthString, b: EthString): -1 | 0 | 1 {
  return parse(a).cmp(parse(b)) as -1 | 0 | 1
}

export function sum(values: EthString[]): EthString {
  return canonical(values.reduce((acc, v) => acc.plus(parse(v)), new B(0)))
}
