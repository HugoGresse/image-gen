declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string | number | boolean> }) => void
  }
}

export function trackEvent(event: string, props?: Record<string, string | number | boolean>): void {
  if (typeof window !== 'undefined' && window.plausible) {
    window.plausible(event, { props })
  }
}
