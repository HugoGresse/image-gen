import type { Project } from './types'

/**
 * Projects can hold hundreds of images, so pictures are stored once as Blobs in
 * their own store and projects only keep their ids.
 */
const DB_NAME = 'image-gen-workspace'
const DB_VERSION = 1
const PROJECTS = 'projects'
const IMAGES = 'images'

export interface StoredImage {
  id: string
  /** Absent when a hosted image could not be downloaded (CORS); `url` is kept instead. */
  blob?: Blob
  url?: string
}

function isAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(PROJECTS)) db.createObjectStore(PROJECTS, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(IMAGES)) db.createObjectStore(IMAGES, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      dbPromise = null
      reject(request.error ?? new Error('Could not open the project database.'))
    }
  })
  return dbPromise
}

function write(storeName: string, work: (store: IDBObjectStore) => void): Promise<void> {
  if (!isAvailable()) return Promise.resolve()
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite')
        transaction.oncomplete = () => resolve()
        transaction.onabort = () => reject(transaction.error ?? new Error('Project storage write failed.'))
        transaction.onerror = () => reject(transaction.error ?? new Error('Project storage write failed.'))
        work(transaction.objectStore(storeName))
      })
  )
}

function read<T>(storeName: string, query: (store: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  if (!isAvailable()) return Promise.resolve(undefined)
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const request = query(db.transaction(storeName, 'readonly').objectStore(storeName))
        request.onsuccess = () => resolve(request.result as T | undefined)
        request.onerror = () => reject(request.error ?? new Error('Project storage read failed.'))
      })
  )
}

export async function loadProjects(): Promise<Project[]> {
  const projects = (await read<Project[]>(PROJECTS, (store) => store.getAll())) ?? []
  return projects.sort((a, b) => b.updatedAt - a.updatedAt)
}

export function saveProjects(projects: Project[]): Promise<void> {
  return write(PROJECTS, (store) => projects.forEach((project) => store.put(project)))
}

export function deleteProjectRecord(id: string): Promise<void> {
  return write(PROJECTS, (store) => store.delete(id))
}

export function putImage(image: StoredImage): Promise<void> {
  return write(IMAGES, (store) => store.put(image))
}

export function getImage(id: string): Promise<StoredImage | undefined> {
  return read<StoredImage>(IMAGES, (store) => store.get(id))
}

export function deleteImages(ids: string[]): Promise<void> {
  if (ids.length === 0) return Promise.resolve()
  return write(IMAGES, (store) => ids.forEach((id) => store.delete(id)))
}
