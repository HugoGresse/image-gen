import { describe, it, expect } from 'vitest'
import { clampIndex, lightboxKeyAction, stepIndex } from '../lib/lightbox'

describe('stepIndex', () => {
  it('moves forward and backward', () => {
    expect(stepIndex(0, 1, 4)).toBe(1)
    expect(stepIndex(2, -1, 4)).toBe(1)
  })

  it('wraps around both ends', () => {
    expect(stepIndex(3, 1, 4)).toBe(0)
    expect(stepIndex(0, -1, 4)).toBe(3)
  })

  it('stays at zero for an empty list', () => {
    expect(stepIndex(0, 1, 0)).toBe(0)
  })
})

describe('clampIndex', () => {
  it('keeps the index inside the list', () => {
    expect(clampIndex(-2, 4)).toBe(0)
    expect(clampIndex(9, 4)).toBe(3)
    expect(clampIndex(2, 4)).toBe(2)
  })

  it('returns zero for an empty list', () => {
    expect(clampIndex(3, 0)).toBe(0)
  })
})

describe('lightboxKeyAction', () => {
  it('closes on Escape', () => {
    expect(lightboxKeyAction('Escape', 5)).toEqual({ type: 'close' })
  })

  it('steps with arrows and space', () => {
    expect(lightboxKeyAction('ArrowRight', 5)).toEqual({ type: 'step', value: 1 })
    expect(lightboxKeyAction('ArrowDown', 5)).toEqual({ type: 'step', value: 1 })
    expect(lightboxKeyAction(' ', 5)).toEqual({ type: 'step', value: 1 })
    expect(lightboxKeyAction('ArrowLeft', 5)).toEqual({ type: 'step', value: -1 })
    expect(lightboxKeyAction('ArrowUp', 5)).toEqual({ type: 'step', value: -1 })
  })

  it('jumps to the first and last image', () => {
    expect(lightboxKeyAction('Home', 5)).toEqual({ type: 'jump', value: 0 })
    expect(lightboxKeyAction('End', 5)).toEqual({ type: 'jump', value: 4 })
    expect(lightboxKeyAction('End', 0)).toEqual({ type: 'jump', value: 0 })
  })

  it('toggles fullscreen on either case of F', () => {
    expect(lightboxKeyAction('f', 5)).toEqual({ type: 'fullscreen' })
    expect(lightboxKeyAction('F', 5)).toEqual({ type: 'fullscreen' })
  })

  it('ignores unrelated keys', () => {
    expect(lightboxKeyAction('a', 5)).toBeNull()
    expect(lightboxKeyAction('Enter', 5)).toBeNull()
  })
})
