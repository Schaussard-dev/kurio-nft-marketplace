/**
 * One-shot scenario effects ("the first quote of the checkout", "the first request with that key").
 * Kept in memory per tab; a mock reset forgets them so the scenario can be replayed.
 */
const fired = new Set<string>()

/** True the first time a mark is seen, false afterwards. */
export function once(mark: string): boolean {
  if (fired.has(mark)) return false
  fired.add(mark)
  return true
}

export function resetScenarioOnce(): void {
  fired.clear()
}
