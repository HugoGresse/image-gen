/**
 * This is a fully client-side, browser-only application.  Storing the
 * OpenRouter API key in localStorage is intentional and required by design:
 * there is no backend, so the key must live in the browser.  Users are
 * informed of this in the UI footer.  The key never leaves the browser except
 * in direct API calls to openrouter.ai.
 */
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
