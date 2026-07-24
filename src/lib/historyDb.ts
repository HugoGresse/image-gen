import type { ImageSession } from '../types'
import { pruneSessions } from './history'

/**
 * Generated images are base64 data URLs, which blow past the ~5 MB localStorage
 * budget almost immediately, so history lives in IndexedDB. Everything stays on
 * the user's machine — nothing is uploaded.
 */
const DB_NAME = 'image-gen'
const DB_VERSION = 1
const STORE = 'sessions'

function isAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open the history database.'))
  })
}

function runTransaction(db: IDBDatabase, mode: IDBTransactionMode, work: (store: IDBObjectStore) => void) {
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode)
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('History write failed.'))
    transaction.onerror = () => reject(transaction.error ?? new Error('History write failed.'))
    work(transaction.objectStore(STORE))
  })
}

export async function loadSessions(): Promise<ImageSession[]> {
  if (!isAvailable()) return []
  const db = await openDb()
  try {
    const stored = await new Promise<ImageSession[]>((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
      request.onsuccess = () => resolve(request.result as ImageSession[])
      request.onerror = () => reject(request.error ?? new Error('Could not read history.'))
    })
    return pruneSessions(stored)
  } finally {
    db.close()
  }
}

/** Replaces the stored history with `sessions`; halves the batch once on a quota error. */
export async function saveSessions(sessions: ImageSession[]): Promise<void> {
  if (!isAvailable()) return
  const db = await openDb()
  try {
    const write = (batch: ImageSession[]) =>
      runTransaction(db, 'readwrite', (store) => {
        store.clear()
        batch.forEach((session) => store.put(session))
      })

    try {
      await write(sessions)
    } catch (error) {
      const isQuota = error instanceof DOMException && error.name === 'QuotaExceededError'
      if (!isQuota || sessions.length <= 1) throw error
      await write(sessions.slice(0, Math.floor(sessions.length / 2)))
    }
  } finally {
    db.close()
  }
}

export async function clearSessions(): Promise<void> {
  if (!isAvailable()) return
  const db = await openDb()
  try {
    await runTransaction(db, 'readwrite', (store) => store.clear())
  } finally {
    db.close()
  }
}
