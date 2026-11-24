import { describe, it, expect } from 'vitest'
import { baseModelId, isRouterModel, modelIdProblem, normaliseCatalogue, usableModelId } from '../chat/catalogue'
import { buildPickerGroups, describeChoice, selectableModels } from '../chat/pickerRows'

// Trimmed sample of GET /api/v1/models
const RAW = [
  {
    id: 'anthropic/claude-sonnet-5',
    name: 'Anthropic: Claude Sonnet 5',
    created: 1_790_000_000,
    context_length: 1_000_000,
    pricing: { prompt: '0.000003', completion: '0.000015' },
    architecture: { input_modalities: ['text', 'image'] },
    supported_parameters: ['tools', 'temperature'],
  },
  {
    id: '~anthropic/claude-haiku-latest',
    name: 'Claude Haiku (latest)',
    created: 1_780_000_000,
    context_length: 200_000,
    pricing: { prompt: '0.0000001', completion: '0.0000005' },
    architecture: { input_modalities: ['text'] },
    supported_parameters: ['tools'],
  },
  { id: 'openrouter/auto', name: 'Auto', pricing: { prompt: '-1', completion: '-1' }, supported_parameters: ['tools'] },
  { id: 'openrouter/fusion', name: 'Fusion', pricing: { prompt: '-1', completion: '-1' }, supported_parameters: ['tools'] },
  { id: 'acme/new-router', name: 'New router', pricing: { prompt: '-1', completion: '-1' }, supported_parameters: ['tools'] },
  { id: 'acme/no-tools', name: 'No tools', pricing: { prompt: '0', completion: '0' }, supported_parameters: ['temperature'] },
]
const catalogue = normaliseCatalogue(RAW)

describe('normaliseCatalogue', () => {
  it('keeps tool-capable models and never prints -1 prices', () => {
    expect(catalogue.map((m) => m.id)).not.toContain('acme/no-tools')
    const auto = catalogue.find((m) => m.id === 'openrouter/auto')
    expect(auto).toMatchObject({ priceVaries: true, promptPriceUsd: null, completionPriceUsd: null })
  })

  it('reads author, alias and image input', () => {
    expect(catalogue.find((m) => m.id.startsWith('~'))).toMatchObject({ author: 'anthropic', isAlias: true, acceptsImages: false })
    expect(catalogue[0]).toMatchObject({ acceptsImages: true, promptPriceUsd: 0.000003, contextLength: 1_000_000 })
  })
})

describe('model id rules', () => {
  it.each([
    ['anthropic/claude-sonnet-5', null],
    ['~anthropic/claude-haiku-latest', null],
    ['meta-llama/llama-4:free', null],
    ['@preset/my-preset', null],
    ['openai/gpt-6@preset/strict', null],
    ['openrouter/auto', null],
    ['openrouter/free', null],
  ])('accepts %s', (id, problem) => {
    expect(modelIdProblem(id, catalogue)).toBe(problem)
  })

  it.each([
    ['', 'Enter a model id.'],
    ['not a model', 'Not a valid OpenRouter model id.'],
    ['openrouter/fusion', 'This router is not supported here.'],
    ['~openrouter/fusion', 'This router is not supported here.'],
    ['acme/new-router', 'This router is not supported here.'],
    ['openrouter/auto:nitro', 'Routers take no :variant.'],
  ])('refuses %s', (id, problem) => {
    expect(modelIdProblem(id, catalogue)).toBe(problem)
  })

  it('strips alias, variant and preset to find the base id', () => {
    expect(baseModelId('~x/y:free@preset/z')).toBe('x/y')
    expect(isRouterModel('openrouter/auto')).toBe(true)
    expect(isRouterModel('anthropic/claude-sonnet-5', catalogue)).toBe(false)
  })

  it('falls back to the default for stored ids that no longer validate', () => {
    expect(usableModelId('openrouter/fusion', catalogue)).toBe('openrouter/auto')
    expect(usableModelId(null)).toBe('openrouter/auto')
    expect(usableModelId(' anthropic/claude-sonnet-5 ', catalogue)).toBe('anthropic/claude-sonnet-5')
  })
})

describe('picker groups', () => {
  const selectable = selectableModels(catalogue)

  it('pins allowed routers first and hides other routers from the model groups', () => {
    const groups = buildPickerGroups(catalogue, selectable, '')
    expect(groups[0].title).toBe('Routers')
    expect(groups[0].rows.map((r) => r.id)).toEqual(['openrouter/auto', 'openrouter/free', 'typesafe/jev-router'])
    const modelIds = groups.slice(1).flatMap((g) => g.rows.map((r) => r.id))
    expect(modelIds).not.toContain('openrouter/fusion')
    expect(modelIds).not.toContain('acme/new-router')
    expect(groups.flatMap((g) => g.rows.map((r) => r.meta)).join(' ')).not.toContain('-1')
  })

  it('filters by query and keeps matching routers on top', () => {
    const groups = buildPickerGroups(catalogue, selectable, 'auto')
    expect(groups.map((g) => g.title)).toEqual(['Routers'])
    expect(buildPickerGroups(catalogue, selectable, 'haiku').flatMap((g) => g.rows.map((r) => r.badge))).toContain('alias')
  })

  it('describes routers, known models, custom ids and refused ids', () => {
    expect(describeChoice('openrouter/auto', catalogue).text).toContain('you pay')
    expect(describeChoice('anthropic/claude-sonnet-5', catalogue).text).toContain('1M ctx')
    expect(describeChoice('acme/unknown', catalogue).text).toContain('Custom id')
    expect(describeChoice('openrouter/fusion', catalogue).tone).toBe('warning')
  })
})
