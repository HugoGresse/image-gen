import type { ImageModel } from '../types'
import { formatCost } from '../lib/money'
import { VECTOR_FORMAT, supportsVector } from '../lib/outputFormat'
import { estimateBatchCost } from '../workspace/cost'
import { projectLabel } from '../workspace/reducer'
import type { NewCard, Project, ProjectSettings, WorkspaceState } from '../workspace/types'
import type { WorkspaceActions } from '../workspace/workspaceContext'
import { findProject } from '../workspace/workspaceContext'
import { isPresetId, missingPresetCards } from '../workspace/presets'
import { projectFrame } from '../workspace/frame'
import type { FrameSettings } from '../workspace/frame'

export interface ConfirmRequest {
  title: string
  detail: string
  confirmLabel: string
}

export interface ToolContext {
  actions: WorkspaceActions
  imageModels: ImageModel[]
  confirm: (request: ConfirmRequest) => Promise<boolean>
}

type Args = Record<string, unknown>

class ToolInputError extends Error {}

function text(args: Args, key: string): string | undefined {
  const value = args[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw new ToolInputError(`${key} must be a string`)
  return value
}

function required(args: Args, key: string): string {
  const value = text(args, key)?.trim()
  if (!value) throw new ToolInputError(`${key} is required`)
  return value
}

function integer(args: Args, key: string): number | undefined {
  const value = args[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new ToolInputError(`${key} must be an integer`)
  return value
}

function strings(args: Args, key: string): string[] | undefined {
  const value = args[key]
  if (value === undefined || value === null) return undefined
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new ToolInputError(`${key} must be an array of strings`)
  }
  return value as string[]
}

function cardsArg(args: Args): NewCard[] {
  const value = args.cards
  if (!Array.isArray(value) || value.length === 0) throw new ToolInputError('cards must be a non-empty array')
  return value.map((item, index) => {
    if (typeof item !== 'object' || item === null) throw new ToolInputError(`cards[${index}] must be an object`)
    const card = item as Args
    return { title: required(card, 'title'), prompt: required(card, 'prompt'), number: text(card, 'number') }
  })
}

function requireProject(state: WorkspaceState, args: Args): Project {
  const id = required(args, 'project_id')
  const project = findProject(state, id)
  if (!project) throw new ToolInputError(`No project with id ${id}`)
  return project
}

function settingsArgs(args: Args, models: ImageModel[], current?: ProjectSettings): Partial<ProjectSettings> {
  const settings: Partial<ProjectSettings> = {}
  const modelId = text(args, 'model_id')
  const model = models.find((m) => m.id === (modelId ?? current?.modelId))
  if (modelId !== undefined) {
    if (!model) throw new ToolInputError(`Unknown image model ${modelId}; call list_image_models`)
    settings.modelId = modelId
  }
  const ratio = text(args, 'ratio')
  if (ratio !== undefined) {
    if (model?.aspectRatios && !model.aspectRatios.includes(ratio)) {
      throw new ToolInputError(`${model.id} accepts ratios ${model.aspectRatios.join(', ')}`)
    }
    settings.ratio = ratio
  }
  const variants = integer(args, 'variants_per_card')
  if (variants !== undefined) settings.variantsPerCard = variants
  const format = text(args, 'output_format')
  if (format !== undefined) {
    if (format === 'svg' && model && !supportsVector(model)) throw new ToolInputError(`${model.id} cannot output SVG`)
    settings.outputFormat = format === 'svg' ? VECTOR_FORMAT : undefined
  }
  return settings
}

export function describeModel(model: ImageModel) {
  return {
    id: model.id,
    name: model.label,
    ratios: model.aspectRatios,
    max_reference_images: model.maxReferenceImages,
    svg: supportsVector(model),
  }
}

export function summarizeWorkspace(state: WorkspaceState) {
  const active = findProject(state, state.activeProjectId ?? '')
  return {
    view: state.view,
    projects: state.projects.map((p) => ({ id: p.id, name: projectLabel(p), items: p.cards.length })),
    active_project: active && {
      id: active.id,
      name: projectLabel(active),
      style_guide: active.styleGuide,
      reference_images: active.referenceIds.length,
      frame: projectFrame(active),
      settings: active.settings,
      items: active.cards.map((card) => ({
        id: card.id,
        number: card.number,
        title: card.title,
        prompt: card.prompt,
        status: card.status,
        variants: card.variants.length,
        ...(card.anchor ? { anchor: true } : {}),
        chosen_variant: card.variants.findIndex((v) => v.id === card.chosenVariantId) + 1 || null,
        ...(card.error ? { error: card.error } : {}),
      })),
    },
  }
}

async function runTool(name: string, args: Args, ctx: ToolContext): Promise<unknown> {
  const { actions, imageModels } = ctx
  const state = actions.getState()

  switch (name) {
    case 'get_workspace':
      return summarizeWorkspace(state)
    case 'list_image_models': {
      const query = text(args, 'query')?.toLowerCase().trim()
      const matches = imageModels.filter((m) => !query || m.id.toLowerCase().includes(query) || m.label.toLowerCase().includes(query))
      return matches.map(describeModel)
    }
    case 'set_view': {
      const view = required(args, 'view')
      if (view !== 'studio' && view !== 'projects') throw new ToolInputError('view must be studio or projects')
      actions.setView(view)
      return { ok: true }
    }
    case 'create_project': {
      const fallback = imageModels[0] && { modelId: imageModels[0].id, ratio: '', variantsPerCard: 1 }
      const settings = settingsArgs(args, imageModels, fallback)
      const id = actions.createProject(required(args, 'name'), settings)
      const styleGuide = text(args, 'style_guide')
      if (styleGuide) actions.updateStyleGuide(id, styleGuide)
      return { ok: true, project_id: id, settings: findProject(actions.getState(), id)?.settings }
    }
    case 'select_project':
      actions.selectProject(requireProject(state, args).id)
      return { ok: true }
    case 'update_project': {
      const project = requireProject(state, args)
      const settings = settingsArgs(args, imageModels, project.settings)
      const name = text(args, 'name')
      const styleGuide = text(args, 'style_guide')
      if (name !== undefined) actions.renameProject(project.id, name)
      if (styleGuide !== undefined) actions.updateStyleGuide(project.id, styleGuide)
      if (Object.keys(settings).length > 0) actions.updateSettings(project.id, settings)
      return { ok: true, settings: findProject(actions.getState(), project.id)?.settings }
    }
    case 'add_cards': {
      const project = requireProject(state, args)
      return { ok: true, card_ids: actions.addCards(project.id, cardsArg(args)) }
    }
    case 'update_card': {
      const project = requireProject(state, args)
      const cardId = required(args, 'card_id')
      if (!project.cards.some((c) => c.id === cardId)) throw new ToolInputError(`No item with id ${cardId}`)
      const patch = { title: text(args, 'title'), number: text(args, 'number'), prompt: text(args, 'prompt') }
      actions.updateCard(project.id, cardId, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)))
      return { ok: true }
    }
    case 'remove_cards': {
      const project = requireProject(state, args)
      const ids = strings(args, 'card_ids') ?? []
      const cards = project.cards.filter((c) => ids.includes(c.id))
      if (cards.length === 0) throw new ToolInputError('None of these item ids exist')
      const approved = await ctx.confirm({
        title: `Delete ${cards.length} item${cards.length === 1 ? '' : 's'}?`,
        detail: `${cards.map((c) => c.title).join(', ')} and their images will be deleted. This cannot be undone.`,
        confirmLabel: 'Delete',
      })
      if (!approved) return { ok: false, reason: 'The user declined.' }
      cards.forEach((card) => actions.removeCard(project.id, card.id))
      return { ok: true, removed: cards.length }
    }
    case 'generate_cards': {
      const project = requireProject(state, args)
      const ids = strings(args, 'card_ids')
      const cards = project.cards.filter(
        (c) => (ids ? ids.includes(c.id) : c.variants.length === 0) && c.status !== 'generating' && c.status !== 'queued'
      )
      if (cards.length === 0) return { ok: false, reason: 'No matching item needs generating.' }
      const images = cards.length * project.settings.variantsPerCard
      const estimate = formatCost(estimateBatchCost(project, cards.length))
      const approved = await ctx.confirm({
        title: `Generate ${cards.length} item${cards.length === 1 ? '' : 's'} (${images} images)?`,
        detail: `${project.settings.modelId}, ratio ${project.settings.ratio}. ${
          estimate ? `Estimated cost ≈ ${estimate}, from this project's previous images.` : 'No cost estimate yet: nothing was generated in this project.'
        }`,
        confirmLabel: 'Generate',
      })
      if (!approved) return { ok: false, reason: 'The user declined.' }
      const queued = actions.queueCards(project.id, cards.map((card) => card.id))
      return { ok: true, queued, note: 'Items generate a few at a time in the background; call get_workspace to follow statuses.' }
    }
    case 'choose_variant': {
      const project = requireProject(state, args)
      const card = project.cards.find((c) => c.id === required(args, 'card_id'))
      const index = integer(args, 'variant')
      const variant = card && index !== undefined ? card.variants[index - 1] : undefined
      if (!card || !variant) throw new ToolInputError('No such item or variant')
      actions.chooseVariant(project.id, card.id, variant.id)
      return { ok: true }
    }
    case 'set_anchor': {
      const project = requireProject(state, args)
      const cardId = required(args, 'card_id')
      if (!project.cards.some((c) => c.id === cardId)) throw new ToolInputError(`No item with id ${cardId}`)
      if (typeof args.anchor !== 'boolean') throw new ToolInputError('anchor must be a boolean')
      actions.setAnchor(project.id, cardId, args.anchor)
      return { ok: true }
    }
    case 'add_preset': {
      const project = requireProject(state, args)
      const preset = required(args, 'preset')
      if (!isPresetId(preset)) throw new ToolInputError(`Unknown preset ${preset}`)
      const cards = missingPresetCards(preset, project.cards.map((card) => card.title))
      return { ok: true, added: cards.length > 0 ? actions.addCards(project.id, cards).length : 0 }
    }
    case 'update_frame': {
      const project = requireProject(state, args)
      const patch: Partial<FrameSettings> = {}
      const flags = { enabled: 'enabled', show_title: 'showTitle', show_number: 'showNumber' } as const
      Object.entries(flags).forEach(([arg, key]) => {
        if (args[arg] === undefined) return
        if (typeof args[arg] !== 'boolean') throw new ToolInputError(`${arg} must be a boolean`)
        patch[key] = args[arg]
      })
      const colors = { border_color: 'borderColor', background_color: 'backgroundColor', text_color: 'textColor' } as const
      Object.entries(colors).forEach(([arg, key]) => {
        const value = text(args, arg)
        if (value === undefined) return
        if (!/^#[0-9a-f]{6}$/i.test(value)) throw new ToolInputError(`${arg} must be a #rrggbb color`)
        patch[key] = value
      })
      const border = args.border_width
      if (border !== undefined) {
        if (typeof border !== 'number') throw new ToolInputError('border_width must be a number')
        patch.borderWidth = border
      }
      const font = text(args, 'font')
      if (font !== undefined) {
        if (font !== 'serif' && font !== 'sans' && font !== 'mono') throw new ToolInputError('font must be serif, sans or mono')
        patch.font = font
      }
      actions.updateFrame(project.id, patch)
      return { ok: true, frame: projectFrame(findProject(actions.getState(), project.id) ?? project) }
    }
    case 'cancel_generation':
      actions.cancelQueue(requireProject(state, args).id)
      return { ok: true }
    case 'delete_project': {
      const project = requireProject(state, args)
      const approved = await ctx.confirm({
        title: `Delete project "${projectLabel(project)}"?`,
        detail: `Its ${project.cards.length} items and all their images will be deleted. This cannot be undone.`,
        confirmLabel: 'Delete project',
      })
      if (!approved) return { ok: false, reason: 'The user declined.' }
      actions.deleteProject(project.id)
      return { ok: true }
    }
    default:
      throw new ToolInputError(`Unknown tool ${name}`)
  }
}

/** Runs one tool call; invalid input comes back as an error the model can correct. */
export async function executeTool(name: string, rawArguments: string, ctx: ToolContext): Promise<string> {
  try {
    const parsed: unknown = rawArguments.trim() ? JSON.parse(rawArguments) : {}
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new ToolInputError('Arguments must be a JSON object')
    }
    return JSON.stringify(await runTool(name, parsed as Args, ctx))
  } catch (error) {
    const message = error instanceof SyntaxError ? 'Arguments are not valid JSON' : error instanceof Error ? error.message : 'Tool failed'
    return JSON.stringify({ ok: false, error: message })
  }
}
