import type { ImageModel } from '../types'
import { VECTOR_FORMAT, isVectorOnly, supportsVector } from '../lib/outputFormat'
import type { ProjectSettings } from './types'

const PREFERRED_RATIO = '2:3'

export function defaultRatio(model: ImageModel | undefined): string {
  const ratios = model?.aspectRatios ?? []
  return ratios.includes(PREFERRED_RATIO) ? PREFERRED_RATIO : (ratios[0] ?? '1:1')
}

/** Brings ratio and output format back to what the project's model accepts. */
export function reconcileSettings(settings: ProjectSettings, model: ImageModel | undefined): ProjectSettings {
  if (!model) return settings
  const ratios = model.aspectRatios
  const ratio = ratios && !ratios.includes(settings.ratio) ? defaultRatio(model) : settings.ratio
  const outputFormat = isVectorOnly(model)
    ? VECTOR_FORMAT
    : settings.outputFormat === VECTOR_FORMAT && !supportsVector(model)
      ? undefined
      : settings.outputFormat
  return ratio === settings.ratio && outputFormat === settings.outputFormat ? settings : { ...settings, ratio, outputFormat }
}
