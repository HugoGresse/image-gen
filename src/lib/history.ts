import type { ImageSession } from '../types'

/** Keep browser storage bounded: images are base64 data URLs and add up fast. */
export const MAX_STORED_SESSIONS = 30

/**
 * Only finished images are worth restoring — loading placeholders would spin
 * forever after a reload, and failed slots carry nothing. Returns null when a
 * session has nothing left to store.
 */
export function sanitizeSession(session: ImageSession): ImageSession | null {
  const images = session.images
    .filter((image) => image.url && !image.loading)
    .map((image) => {
      const stored = { ...image, selected: false }
      delete stored.loading
      return stored
    })

  return images.length > 0 ? { ...session, images } : null
}

/** Newest sessions first, capped so old batches fall out of storage. */
export function pruneSessions(sessions: ImageSession[], max = MAX_STORED_SESSIONS): ImageSession[] {
  return sessions
    .map(sanitizeSession)
    .filter((session): session is ImageSession => session !== null)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, max)
}
