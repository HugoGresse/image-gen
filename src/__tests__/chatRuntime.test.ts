import { describe, it, expect, vi } from 'vitest'
import { buildChatBody, billedCost, parseReply } from '../chat/openrouterChat'
import type { ChatMessage } from '../chat/openrouterChat'
import { closeDanglingToolCalls, trimHistory } from '../chat/conversation'
import { executeTool, summarizeWorkspace } from '../chat/toolRunner'
import type { ToolContext } from '../chat/toolRunner'
import { initialWorkspace, workspaceReducer } from '../workspace/reducer'
import type { WorkspaceAction } from '../workspace/reducer'
import type { WorkspaceState } from '../workspace/types'
import type { WorkspaceActions } from '../workspace/workspaceContext'
import type { ImageModel } from '../types'

describe('buildChatBody', () => {
  it('requires parameters for routers and leaves concrete models untouched', () => {
    const tools = [{ type: 'function' as const, function: { name: 't', description: '', parameters: {} } }]
    expect(buildChatBody({ model: 'openrouter/auto', messages: [], tools })).toMatchObject({
      provider: { require_parameters: true },
      tool_choice: 'auto',
    })
    const concrete = buildChatBody({ model: 'anthropic/claude-sonnet-5', messages: [] })
    expect(concrete).not.toHaveProperty('provider')
    expect(concrete).not.toHaveProperty('temperature')
    expect(concrete).not.toHaveProperty('tool_choice')
  })
})

describe('parseReply', () => {
  it('records the served model, tool calls and cost including BYOK upstream', () => {
    const reply = parseReply(
      {
        model: 'anthropic/claude-sonnet-5',
        choices: [{ finish_reason: 'tool_calls', message: { content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'get_workspace', arguments: '{}' } }] } }],
        usage: { cost: 0.001, is_byok: true, cost_details: { upstream_inference_cost: 0.004 } },
      },
      'openrouter/auto'
    )
    expect(reply.servedModel).toBe('anthropic/claude-sonnet-5')
    expect(reply.message.tool_calls).toHaveLength(1)
    expect(reply.cost).toBeCloseTo(0.005)
  })

  it('treats a 200 error body as a failure and a cut-off empty answer as truncated', () => {
    expect(() => parseReply({ error: { message: 'Provider down' } }, 'm')).toThrow('Provider down')
    expect(() => parseReply({ choices: [{ finish_reason: 'length', message: { content: '' } }] }, 'm')).toThrow('ran out of tokens')
    expect(billedCost(undefined)).toBeNull()
  })
})

const call = (id: string) => ({ id, type: 'function' as const, function: { name: 'x', arguments: '{}' } })

describe('conversation helpers', () => {
  it('answers tool calls left open and drops orphan tool answers', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: null, tool_calls: [call('a'), call('b')] },
      { role: 'tool', tool_call_id: 'a', content: '{"ok":true}' },
      { role: 'tool', tool_call_id: 'zzz', content: '{}' },
    ]
    const closed = closeDanglingToolCalls(messages, 'Stopped')
    expect(closed.filter((m) => m.role === 'tool').map((m) => (m as { tool_call_id: string }).tool_call_id)).toEqual(['a', 'b'])
  })

  it('trims history to start on a user turn', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: '1' },
      { role: 'assistant', content: null, tool_calls: [call('a')] },
      { role: 'tool', tool_call_id: 'a', content: '{}' },
      { role: 'user', content: '2' },
      { role: 'assistant', content: 'ok' },
    ]
    expect(trimHistory(messages, 3)).toEqual(messages.slice(3))
    expect(trimHistory(messages, 10)).toBe(messages)
  })

  it('keeps the last turn whole when it alone exceeds the cap', () => {
    const longTurn: ChatMessage[] = [
      { role: 'user', content: 'old' },
      { role: 'assistant', content: 'ok' },
      { role: 'user', content: 'big' },
      ...Array.from({ length: 5 }, (): ChatMessage => ({ role: 'assistant', content: 'step' })),
    ]
    expect(trimHistory(longTurn, 3)[0]).toEqual({ role: 'user', content: 'big' })
  })
})

const imageModel: ImageModel = {
  id: 'openai/gpt-image-2.6-flare',
  label: 'Flare',
  description: '',
  createdAt: null,
  aspectRatios: ['1:1', '2:3'],
  resolutions: null,
  maxImagesPerRequest: 10,
  maxReferenceImages: 16,
  outputFormats: ['png'],
  imageOutputPrice: null,
}

function fakeContext(confirmAnswer: boolean) {
  let state: WorkspaceState = { ...initialWorkspace, loaded: true }
  const apply = (action: WorkspaceAction) => {
    state = workspaceReducer(state, action)
  }
  let next = 0
  const queueCards = vi.fn((_id: string, ids: string[]) => ids.length)
  const actions = {
    getState: () => state,
    setView: (view) => apply({ type: 'setView', view }),
    createProject: (name, settings) => {
      const id = `p${++next}`
      apply({ type: 'createProject', id, name, now: 1, settings: { modelId: imageModel.id, ratio: '1:1', variantsPerCard: 2, ...settings } })
      return id
    },
    updateStyleGuide: (id, styleGuide) => apply({ type: 'updateStyleGuide', id, styleGuide, now: 1 }),
    updateSettings: (id, settings) => apply({ type: 'updateSettings', id, settings, now: 1 }),
    addCards: (id, cards) => {
      const withIds = cards.map((card) => ({ ...card, id: `c${++next}` }))
      apply({ type: 'addCards', id, cards: withIds, now: 1 })
      return withIds.map((c) => c.id)
    },
    queueCards,
  } as Partial<WorkspaceActions> as WorkspaceActions
  const confirm = vi.fn().mockResolvedValue(confirmAnswer)
  const ctx: ToolContext = { actions, imageModels: [imageModel], confirm }
  return { ctx, confirm, queueCards, getState: () => state }
}

describe('executeTool', () => {
  it('creates a project with validated settings and adds items', async () => {
    const { ctx, getState } = fakeContext(true)
    const created = JSON.parse(await executeTool('create_project', '{"name":"Tarot","ratio":"2:3","style_guide":"gold"}', ctx))
    expect(created.ok).toBe(true)
    await executeTool('add_cards', JSON.stringify({ project_id: created.project_id, cards: [{ title: 'The Fool', prompt: 'a traveller' }] }), ctx)
    const summary = summarizeWorkspace(getState())
    expect(summary.active_project).toMatchObject({ name: 'Tarot', style_guide: 'gold', settings: { ratio: '2:3' } })
    expect(summary.active_project?.items[0]).toMatchObject({ title: 'The Fool', variants: 0, chosen_variant: null })
  })

  it('returns input errors to the model instead of throwing', async () => {
    const { ctx } = fakeContext(true)
    expect(JSON.parse(await executeTool('create_project', '{"name":"X","ratio":"21:9"}', ctx)).error).toContain('accepts ratios')
    expect(JSON.parse(await executeTool('add_cards', '{"project_id":"nope","cards":[]}', ctx)).ok).toBe(false)
    expect(JSON.parse(await executeTool('create_project', '{bad json', ctx)).error).toBe('Arguments are not valid JSON')
    expect(JSON.parse(await executeTool('unknown', '{}', ctx)).error).toBe('Unknown tool unknown')
  })

  it('asks before generating and only generates once approved', async () => {
    for (const approved of [false, true]) {
      const { ctx, confirm, queueCards } = fakeContext(approved)
      const { project_id } = JSON.parse(await executeTool('create_project', '{"name":"T"}', ctx))
      await executeTool('add_cards', JSON.stringify({ project_id, cards: [{ title: 'A', prompt: 'a' }, { title: 'B', prompt: 'b' }] }), ctx)
      const result = JSON.parse(await executeTool('generate_cards', JSON.stringify({ project_id }), ctx))
      expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Generate 2 items (4 images)?' }))
      expect(result.ok).toBe(approved)
      expect(queueCards).toHaveBeenCalledTimes(approved ? 1 : 0)
      if (approved) expect(result.queued).toBe(2)
    }
  })
})
