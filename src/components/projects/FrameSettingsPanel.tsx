import type { FrameFont, FrameSettings } from '../../workspace/frame'
import { projectFrame } from '../../workspace/frame'
import type { Project } from '../../workspace/types'
import { useWorkspace } from '../../workspace/workspaceContext'

const LABEL = 'text-xs text-zinc-400 flex items-center gap-2'
const COLORS: { key: 'borderColor' | 'backgroundColor' | 'textColor'; label: string }[] = [
  { key: 'borderColor', label: 'Border' },
  { key: 'backgroundColor', label: 'Bands' },
  { key: 'textColor', label: 'Text' },
]
const FONTS: FrameFont[] = ['serif', 'sans', 'mono']

export function FrameSettingsPanel({ project }: { project: Project }) {
  const { actions } = useWorkspace()
  const frame = projectFrame(project)
  const update = (patch: Partial<FrameSettings>) => actions.updateFrame(project.id, patch)

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-zinc-200">
        <input type="checkbox" checked={frame.enabled} onChange={(e) => update({ enabled: e.target.checked })} className="accent-violet-500" />
        Draw a frame, title and number around each item
      </label>
      {frame.enabled && (
        <div className="flex flex-wrap gap-x-6 gap-y-3 pl-6">
          {COLORS.map(({ key, label }) => (
            <label key={key} className={LABEL}>
              {label}
              <input
                type="color"
                value={frame[key]}
                onChange={(e) => update({ [key]: e.target.value })}
                className="w-8 h-6 bg-transparent border border-zinc-700 rounded cursor-pointer"
              />
            </label>
          ))}
          <label className={LABEL}>
            Border
            <input
              type="range"
              min={0}
              max={12}
              step={0.5}
              value={frame.borderWidth}
              onChange={(e) => update({ borderWidth: Number(e.target.value) })}
              className="accent-violet-500 w-24"
            />
          </label>
          <label className={LABEL}>
            Corners
            <input
              type="range"
              min={0}
              max={12}
              step={0.5}
              value={frame.cornerRadius}
              onChange={(e) => update({ cornerRadius: Number(e.target.value) })}
              className="accent-violet-500 w-24"
            />
          </label>
          <label className={LABEL}>
            Font
            <select
              value={frame.font}
              onChange={(e) => update({ font: e.target.value as FrameFont })}
              className="bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-200"
            >
              {FONTS.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </label>
          <label className={LABEL}>
            <input type="checkbox" checked={frame.showTitle} onChange={(e) => update({ showTitle: e.target.checked })} className="accent-violet-500" />
            Title
          </label>
          <label className={LABEL}>
            <input type="checkbox" checked={frame.showNumber} onChange={(e) => update({ showNumber: e.target.checked })} className="accent-violet-500" />
            Number
          </label>
        </div>
      )}
    </div>
  )
}
