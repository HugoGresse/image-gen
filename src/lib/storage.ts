const API_KEY_STORAGE_KEY = 'openrouter_api_key'

export function getStoredApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE_KEY) ?? ''
}

export function saveApiKey(key: string): void {
  if (key) {
    localStorage.setItem(API_KEY_STORAGE_KEY, key)
  } else {
    localStorage.removeItem(API_KEY_STORAGE_KEY)
  }
}
