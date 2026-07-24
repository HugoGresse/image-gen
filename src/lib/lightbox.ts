/** Moves through a list of images, wrapping around at both ends. */
export function stepIndex(current: number, delta: number, length: number): number {
  if (length <= 0) return 0
  return (((current + delta) % length) + length) % length
}

export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0
  return Math.min(Math.max(index, 0), length - 1)
}

export interface LightboxKeyAction {
  type: 'close' | 'step' | 'jump' | 'fullscreen'
  value?: number
}

/**
 * Maps a key press to a viewer action, so the keyboard contract is testable
 * without mounting the component.
 */
export function lightboxKeyAction(key: string, length: number): LightboxKeyAction | null {
  switch (key) {
    case 'Escape':
      return { type: 'close' }
    case 'ArrowRight':
    case 'ArrowDown':
    case ' ':
      return { type: 'step', value: 1 }
    case 'ArrowLeft':
    case 'ArrowUp':
      return { type: 'step', value: -1 }
    case 'Home':
      return { type: 'jump', value: 0 }
    case 'End':
      return { type: 'jump', value: Math.max(length - 1, 0) }
    case 'f':
    case 'F':
      return { type: 'fullscreen' }
    default:
      return null
  }
}
