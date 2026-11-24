import type { ToolDefinition } from './openrouterChat'

function tool(name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []): ToolDefinition {
  return {
    type: 'function',
    function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } },
  }
}

const projectId = { type: 'string', description: 'Project id from get_workspace' }
const cardInput = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Caption drawn on the item, e.g. "The Fool"' },
    number: { type: 'string', description: 'Optional label such as "0" or "XIII"' },
    prompt: { type: 'string', description: 'What the illustration shows, in English, without style (the style guide is added automatically)' },
  },
  required: ['title', 'prompt'],
  additionalProperties: false,
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  tool('get_workspace', 'Read the current view, every project and the active project with its items, settings and statuses. Call this before acting on ids.'),
  tool('list_image_models', 'List image generation models with their ratios, reference image limit and SVG support.', {
    query: { type: 'string', description: 'Optional filter on id or name' },
  }),
  tool('set_view', 'Show the Studio (free generation) or the Projects view.', {
    view: { type: 'string', enum: ['studio', 'projects'] },
  }, ['view']),
  tool('create_project', 'Create a project (a consistent series, e.g. a card deck) and make it active.', {
    name: { type: 'string' },
    style_guide: { type: 'string', description: 'Shared art direction added to every item prompt' },
    model_id: { type: 'string', description: 'Image model id from list_image_models' },
    ratio: { type: 'string', description: 'A ratio the model accepts, e.g. "2:3"' },
    variants_per_card: { type: 'integer', minimum: 1, maximum: 4 },
  }, ['name']),
  tool('select_project', 'Make a project active and show it.', { project_id: projectId }, ['project_id']),
  tool('update_project', 'Change a project name, style guide or generation settings.', {
    project_id: projectId,
    name: { type: 'string' },
    style_guide: { type: 'string' },
    model_id: { type: 'string' },
    ratio: { type: 'string' },
    variants_per_card: { type: 'integer', minimum: 1, maximum: 4 },
    output_format: { type: 'string', enum: ['raster', 'svg'] },
  }, ['project_id']),
  tool('add_cards', 'Add items to a project. Does not generate them.', {
    project_id: projectId,
    cards: { type: 'array', items: cardInput, minItems: 1 },
  }, ['project_id', 'cards']),
  tool('update_card', 'Edit an item title, number or prompt.', {
    project_id: projectId,
    card_id: { type: 'string' },
    title: { type: 'string' },
    number: { type: 'string' },
    prompt: { type: 'string' },
  }, ['project_id', 'card_id']),
  tool('remove_cards', 'Delete items and their images. The user is asked to confirm.', {
    project_id: projectId,
    card_ids: { type: 'array', items: { type: 'string' }, minItems: 1 },
  }, ['project_id', 'card_ids']),
  tool('generate_cards', 'Queue items for image generation (this spends credit; a few run at a time). The user is shown the estimated cost and must approve. Omit card_ids to queue every item that has no image yet.', {
    project_id: projectId,
    card_ids: { type: 'array', items: { type: 'string' } },
  }, ['project_id']),
  tool('choose_variant', 'Pick which generated variant an item uses (1-based index).', {
    project_id: projectId,
    card_id: { type: 'string' },
    variant: { type: 'integer', minimum: 1 },
  }, ['project_id', 'card_id', 'variant']),
  tool('set_anchor', 'Mark an item as a style anchor (or unmark it). The chosen image of every anchor is sent as a reference when generating the other items: generate and approve 2-3 anchors first, then the rest.', {
    project_id: projectId,
    card_id: { type: 'string' },
    anchor: { type: 'boolean' },
  }, ['project_id', 'card_id', 'anchor']),
  tool('add_preset', 'Add a ready-made list of items with numbers, titles and prompts.', {
    project_id: projectId,
    preset: { type: 'string', enum: ['tarot-major', 'tarot-full'], description: 'tarot-major = 22 major arcana, tarot-full = all 78 cards' },
  }, ['project_id', 'preset']),
  tool('update_frame', 'Configure the frame the app draws around every item (border, bands with title and number).', {
    project_id: projectId,
    enabled: { type: 'boolean' },
    border_color: { type: 'string', description: '#rrggbb' },
    background_color: { type: 'string', description: '#rrggbb, behind the title and number' },
    text_color: { type: 'string', description: '#rrggbb' },
    border_width: { type: 'number', minimum: 0, maximum: 12, description: 'Percent of the item width' },
    font: { type: 'string', enum: ['serif', 'sans', 'mono'] },
    show_title: { type: 'boolean' },
    show_number: { type: 'boolean' },
  }, ['project_id']),
  tool('cancel_generation', 'Cancel the items still waiting in the generation queue (running ones finish).', { project_id: projectId }, ['project_id']),
  tool('delete_project', 'Delete a project and all its images. The user is asked to confirm.', { project_id: projectId }, ['project_id']),
]

export const SYSTEM_PROMPT = `You are the assistant of an image generation app built on OpenRouter. You drive the app through tools: the user sees every change live.

Projects hold a series of items (for example the 78 cards of a tarot deck) that must look consistent. Consistency comes from the project, not from individual prompts:
- the style guide is prepended to every item prompt, so keep item prompts about the subject only;
- style reference images are sent with every item;
- anchor items: their chosen image is sent as a reference for every other item. For a big series, generate 2-3 anchors first, let the user pick variants, mark them as anchors, then generate the rest;
- the model, ratio and output format are fixed per project.
When the project's frame is enabled (update_frame), the app draws the border, title and number around each illustration, so item prompts must never ask for text, borders or titles. Exports (ZIP, print/PDF) are done by the user from the Projects view.

Rules:
- Call get_workspace before using ids, and after changes when you need fresh state.
- Generating spends the user's credit: use generate_cards, which shows them the cost and asks for approval. Never claim images exist before they are generated.
- Write item prompts and style guides in English (image models follow English best), but answer the user in their language.
- Be brief: say what you did and what the user can do next.`
