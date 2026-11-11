import type { EventEnvelope } from '@/shared/contracts'

export interface EventGuard {
  /**
   * True when the event should be applied, and then records it. False for an eventId already seen,
   * a version at or below the last applied one of the same resource, or another user's event.
   */
  shouldApply(envelope: EventEnvelope, currentUserId: string | null): boolean
}

/**
 * Dedupe + monotonic versioning for socket events (spec §7). Event ids live in a bounded LRU; the
 * per-resource version barrier keeps blocking old events after their id was evicted.
 */
export function createEventGuard({ maxIds = 500 }: { maxIds?: number } = {}): EventGuard {
  // A Set keeps insertion order: the first entry is the least recently seen id.
  const seenIds = new Set<string>()
  const lastVersion = new Map<string, number>()

  return {
    shouldApply(envelope, currentUserId) {
      if (seenIds.has(envelope.eventId)) {
        seenIds.delete(envelope.eventId)
        seenIds.add(envelope.eventId)
        return false
      }
      // Second barrier besides the server rooms: never act on someone else's event.
      if (envelope.userId !== null && envelope.userId !== currentUserId) return false
      const resourceKey = `${envelope.resource.type}:${envelope.resource.id}`
      const last = lastVersion.get(resourceKey)
      if (last !== undefined && envelope.version <= last) return false

      seenIds.add(envelope.eventId)
      if (seenIds.size > maxIds) seenIds.delete(seenIds.values().next().value as string)
      lastVersion.set(resourceKey, envelope.version)
      return true
    },
  }
}
