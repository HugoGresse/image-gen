import { describe, it, expect } from 'vitest'
import { initialWorkspace, referencedImageIds, workspaceReducer } from '../workspace/reducer'
import type { WorkspaceAction } from '../workspace/reducer'
import type { WorkspaceState } from '../workspace/types'

const SETTINGS = { modelId: 'openai/gpt-image-2.6-flare', ratio: '2:3', variantsPerCard: 2 }

function run(actions: WorkspaceAction[], state: WorkspaceState = { ...initialWorkspace, loaded: true }) {
  return actions.reduce(workspaceReducer, state)
}

const created = run([
  { type: 'createProject', id: 'p1', name: '  Tarot  ', settings: SETTINGS, now: 1 },
  { type: 'addCards', id: 'p1', now: 2, cards: [{ id: 'c1', title: ' The Fool ', number: '0', prompt: ' a traveller ' }] },
])

describe('workspaceReducer', () => {
  it('creates a project, makes it active and switches to the projects view', () => {
    expect(created.activeProjectId).toBe('p1')
    expect(created.view).toBe('projects')
    expect(created.projects[0]).toMatchObject({ name: 'Tarot', styleGuide: '', referenceIds: [], settings: SETTINGS })
  })

  it('names untitled projects and clamps the variant count', () => {
    const state = run([{ type: 'createProject', id: 'p2', name: ' ', settings: { ...SETTINGS, variantsPerCard: 9 }, now: 1 }])
    expect(state.projects[0].name).toBe('Untitled project')
    expect(state.projects[0].settings.variantsPerCard).toBe(4)
  })

  it('adds trimmed cards in idle state', () => {
    expect(created.projects[0].cards[0]).toEqual({
      id: 'c1',
      title: 'The Fool',
      number: '0',
      prompt: 'a traveller',
      status: 'idle',
      variants: [],
    })
  })

  it('tracks a generation and picks the first variant by default', () => {
    const variants = [
      { id: 'v1', imageId: 'i1', createdAt: 3, cost: 0.02 },
      { id: 'v2', imageId: 'i2', createdAt: 3, cost: 0.02 },
    ]
    const generating = run([{ type: 'generationStarted', id: 'p1', cardId: 'c1' }], created)
    expect(generating.projects[0].cards[0].status).toBe('generating')

    const done = run([{ type: 'generationFinished', id: 'p1', cardId: 'c1', variants, now: 4 }], generating)
    expect(done.projects[0].cards[0]).toMatchObject({ status: 'idle', chosenVariantId: 'v1' })
    expect(done.projects[0].updatedAt).toBe(4)

    const regenerated = run(
      [{ type: 'generationFinished', id: 'p1', cardId: 'c1', variants: [{ id: 'v3', imageId: 'i3', createdAt: 5, cost: null }], now: 5 }],
      done
    )
    expect(regenerated.projects[0].cards[0].chosenVariantId).toBe('v3')

    const chosen = run([{ type: 'chooseVariant', id: 'p1', cardId: 'c1', variantId: 'v2', now: 5 }], done)
    expect(chosen.projects[0].cards[0].chosenVariantId).toBe('v2')
    const ignored = run([{ type: 'chooseVariant', id: 'p1', cardId: 'c1', variantId: 'nope', now: 6 }], chosen)
    expect(ignored.projects[0].cards[0].chosenVariantId).toBe('v2')
  })

  it('marks a card as failed only when nothing arrived', () => {
    const failed = run([{ type: 'generationFinished', id: 'p1', cardId: 'c1', variants: [], error: 'boom', now: 4 }], created)
    expect(failed.projects[0].cards[0]).toMatchObject({ status: 'error', error: 'boom' })

    const partial = run(
      [{ type: 'generationFinished', id: 'p1', cardId: 'c1', variants: [{ id: 'v1', imageId: 'i1', createdAt: 1, cost: null }], error: 'one failed', now: 4 }],
      created
    )
    expect(partial.projects[0].cards[0].status).toBe('idle')
  })

  it('puts cards left generating back to idle when loading', () => {
    const stuck = { ...created.projects[0], cards: [{ ...created.projects[0].cards[0], status: 'generating' as const }] }
    const state = workspaceReducer(initialWorkspace, { type: 'loaded', projects: [stuck] })
    expect(state.projects[0].cards[0].status).toBe('idle')
    expect(state.activeProjectId).toBe('p1')
  })

  it('keeps projects created before storage finished loading', () => {
    const early = run([{ type: 'createProject', id: 'early', name: 'Early', settings: SETTINGS, now: 1 }], initialWorkspace)
    const state = workspaceReducer(early, { type: 'loaded', projects: [{ ...created.projects[0] }] })
    expect(state.projects.map((p) => p.id)).toEqual(['early', 'p1'])
    expect(state.activeProjectId).toBe('early')
  })

  it('keeps the raw name while typing', () => {
    const state = run([{ type: 'renameProject', id: 'p1', name: 'My ', now: 2 }], created)
    expect(state.projects[0].name).toBe('My ')
  })

  it('moves the selection when the active project is deleted', () => {
    const two = run([{ type: 'createProject', id: 'p2', name: 'Other', settings: SETTINGS, now: 5 }], created)
    expect(two.activeProjectId).toBe('p2')
    const after = run([{ type: 'deleteProject', id: 'p2' }], two)
    expect(after.activeProjectId).toBe('p1')
  })

  it('does not duplicate references and lists every stored image', () => {
    const state = run(
      [
        { type: 'addReferences', id: 'p1', imageIds: ['r1', 'r1'], now: 3 },
        { type: 'addReferences', id: 'p1', imageIds: ['r1', 'r2'], now: 4 },
        { type: 'generationFinished', id: 'p1', cardId: 'c1', variants: [{ id: 'v1', imageId: 'i1', createdAt: 1, cost: null }], now: 5 },
      ],
      created
    )
    expect(state.projects[0].referenceIds).toEqual(['r1', 'r2'])
    expect(referencedImageIds(state.projects[0])).toEqual(['r1', 'r2', 'i1'])
  })
})
