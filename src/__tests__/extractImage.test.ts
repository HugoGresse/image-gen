import { describe, it, expect } from 'vitest'
import { extractImage } from '../lib/openrouter'

describe('extractImage', () => {
  it('returns the generated image url', () => {
    const data = {
      choices: [{ message: { images: [{ image_url: { url: 'data:image/png;base64,AAAA' } }] } }],
    }
    expect(extractImage(data)).toEqual({ url: 'data:image/png;base64,AAAA', text: '' })
  })

  it('returns the text a model answered with when it produced no image', () => {
    const data = { choices: [{ message: { content: '  I cannot create that image.  ' } }] }
    expect(extractImage(data)).toEqual({ url: null, text: 'I cannot create that image.' })
  })

  it('joins text parts of a multimodal reply', () => {
    const data = {
      choices: [
        {
          message: {
            content: [
              { type: 'text', text: 'Here is' },
              { type: 'other' },
              { type: 'text', text: 'my answer.' },
            ],
          },
        },
      ],
    }
    expect(extractImage(data)).toEqual({ url: null, text: 'Here is my answer.' })
  })

  it('handles an empty or malformed response', () => {
    expect(extractImage({})).toEqual({ url: null, text: '' })
    expect(extractImage({ choices: [] })).toEqual({ url: null, text: '' })
  })
})
