import { describe, it, expect } from 'vitest'
import { composeCardPrompt, parseCardList } from '../workspace/prompt'

describe('composeCardPrompt', () => {
  it('puts the shared style before the subject', () => {
    const prompt = composeCardPrompt(' gold engraving ', { title: 'The Fool', prompt: 'a traveller' })
    expect(prompt.indexOf('gold engraving')).toBeLessThan(prompt.indexOf('Subject: a traveller'))
  })

  it('falls back to the title and skips an empty style guide', () => {
    const prompt = composeCardPrompt('', { title: 'The Fool', prompt: ' ' })
    expect(prompt).toContain('Subject: The Fool')
    expect(prompt).not.toContain('Art direction')
  })
})

describe('parseCardList', () => {
  it('uses the prompt as title when the title column is empty', () => {
    expect(parseCardList('| a red dragon\n | ')).toEqual([{ title: 'a red dragon', prompt: 'a red dragon' }])
  })

  it('reads one, two and three column lines and skips blanks', () => {
    expect(parseCardList('The Sun\n\nThe Moon | a wolf howling\nXIII | Death | a skeleton | riding')).toEqual([
      { title: 'The Sun', prompt: 'The Sun' },
      { title: 'The Moon', prompt: 'a wolf howling' },
      { number: 'XIII', title: 'Death', prompt: 'a skeleton | riding' },
    ])
  })
})
