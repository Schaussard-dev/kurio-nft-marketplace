export const ENS_SUFFIX = '.eth'

/** The ENS field holds the name without the ".eth" suffix (Figma draws the suffix as a selector). */
export const ENS_LABEL_PATTERN = /^(?:[a-z0-9-]+(?:\.[a-z0-9-]+)*)?$/i
export const ENS_LABEL_ERROR = 'Use letras, números ou hífen'

export const toFormEns = (ensName: string) =>
  ensName.endsWith(ENS_SUFFIX) ? ensName.slice(0, -ENS_SUFFIX.length) : ensName

// A pasted "foo.eth" must not become "foo.eth.eth": a trailing .eth is dropped before the suffix is added.
export const toStoredEns = (name: string) => {
  const label = name.trim().replace(/\.eth$/i, '')
  return label ? `${label}${ENS_SUFFIX}` : ''
}
