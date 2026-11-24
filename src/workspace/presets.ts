import type { NewCard } from './types'

const MAJOR_ARCANA: [string, string, string][] = [
  ['0', 'The Fool', 'a carefree young traveller stepping toward a cliff edge, a small bundle on a stick, a little dog at his heels, bright sky'],
  ['I', 'The Magician', 'a figure raising a wand to the sky, a table holding a cup, a sword, a coin and a staff, infinity sign above the head'],
  ['II', 'The High Priestess', 'a serene priestess seated between a dark and a light pillar, a scroll in her lap, a crescent moon at her feet'],
  ['III', 'The Empress', 'a crowned woman resting on cushions in a lush wheat field, a shield bearing the symbol of Venus'],
  ['IV', 'The Emperor', 'a bearded ruler on a stone throne carved with ram heads, holding a sceptre and an orb, barren mountains behind'],
  ['V', 'The Hierophant', 'a religious leader raising a hand in blessing, two acolytes kneeling before him, crossed keys at his feet'],
  ['VI', 'The Lovers', 'two lovers standing beneath a radiant angel, a tree of fruit and a tree of flames behind them'],
  ['VII', 'The Chariot', 'an armoured charioteer under a starry canopy, drawn by a black and a white sphinx'],
  ['VIII', 'Strength', 'a calm woman gently closing the jaws of a lion, an infinity sign above her head, flowers in her hair'],
  ['IX', 'The Hermit', 'a cloaked old man on a snowy peak holding up a lantern with a shining star inside, leaning on a staff'],
  ['X', 'Wheel of Fortune', 'a great turning wheel inscribed with symbols in the clouds, a sphinx on top, winged creatures in the four corners'],
  ['XI', 'Justice', 'a seated figure holding an upright sword and balanced scales, between two pillars'],
  ['XII', 'The Hanged Man', 'a man hanging upside down by one foot from a living tree, calm face surrounded by a halo'],
  ['XIII', 'Death', 'a skeleton in black armour riding a pale horse, carrying a banner with a white rose, a sunrise between two towers'],
  ['XIV', 'Temperance', 'a winged angel pouring water between two cups, one foot on land and one in a pool, a path to distant mountains'],
  ['XV', 'The Devil', 'a horned figure perched on a pedestal, two chained figures below with loose chains around their necks'],
  ['XVI', 'The Tower', 'a tall tower struck by lightning, its crown blown off, flames and two figures falling'],
  ['XVII', 'The Star', 'a kneeling figure pouring water into a pool and onto the land under one large star and seven small stars'],
  ['XVIII', 'The Moon', 'a full moon with a face above a path between two towers, a dog and a wolf howling, a crayfish rising from a pool'],
  ['XIX', 'The Sun', 'a radiant sun with a face above a walled garden of sunflowers, a joyful child riding a white horse'],
  ['XX', 'Judgement', 'an angel blowing a trumpet from the clouds, figures rising from open coffins with arms raised'],
  ['XXI', 'The World', 'a dancing figure inside a laurel wreath, the four winged creatures in the corners'],
]

const SUITS = [
  { name: 'Wands', object: 'wooden staffs sprouting green leaves', element: 'fire, ambition and creative energy' },
  { name: 'Cups', object: 'ornate golden cups', element: 'water, emotion and relationships' },
  { name: 'Swords', object: 'steel swords', element: 'air, thought and conflict' },
  { name: 'Pentacles', object: 'golden coins engraved with a five-pointed star', element: 'earth, work and material things' },
]

const PIPS = ['Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']
const COURTS = [
  { name: 'Page', role: 'a curious young messenger studying' },
  { name: 'Knight', role: 'a knight on horseback charging forward with' },
  { name: 'Queen', role: 'a composed queen on a throne holding' },
  { name: 'King', role: 'a commanding king on a throne holding' },
]

function minorArcana(): NewCard[] {
  return SUITS.flatMap((suit) => [
    ...PIPS.map((rank, index) => ({
      number: String(index + 1),
      title: `${rank} of ${suit.name}`,
      prompt:
        index === 0
          ? `a hand emerging from a cloud holding one of the ${suit.object}, symbol of ${suit.element}`
          : `a scene with ${index + 1} ${suit.object} arranged in the composition, evoking ${suit.element}`,
    })),
    ...COURTS.map((court) => ({
      number: '',
      title: `${court.name} of ${suit.name}`,
      prompt: `${court.role} one of the ${suit.object}, embodying ${suit.element}`,
    })),
  ])
}

export const PRESETS = {
  'tarot-major': { label: 'Tarot — 22 major arcana', cards: (): NewCard[] => MAJOR_ARCANA.map(([number, title, prompt]) => ({ number, title, prompt })) },
  'tarot-full': {
    label: 'Tarot — full deck (78)',
    cards: (): NewCard[] => [...PRESETS['tarot-major'].cards(), ...minorArcana()],
  },
} as const

export type PresetId = keyof typeof PRESETS

export function isPresetId(value: string): value is PresetId {
  return Object.hasOwn(PRESETS, value)
}

/** Preset items not already in the list (matched by title), so adding a preset twice adds nothing. */
export function missingPresetCards(id: PresetId, existingTitles: string[]): NewCard[] {
  const existing = new Set(existingTitles.map((title) => title.trim().toLowerCase()))
  return PRESETS[id].cards().filter((card) => !existing.has(card.title.toLowerCase()))
}
