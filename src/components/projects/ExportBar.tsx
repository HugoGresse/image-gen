import { useState } from 'react'
import { exportZip, exportableItems, printProject } from '../../workspace/exportCards'
import type { Project } from '../../workspace/types'

const DEFAULT_WIDTH_MM = 70

export function ExportBar({ project }: { project: Project }) {
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [widthInput, setWidthInput] = useState(String(DEFAULT_WIDTH_MM))
  const widthMm = Math.min(Math.max(Number(widthInput) || DEFAULT_WIDTH_MM, 20), 200)
  const count = exportableItems(project).length

  async function run(task: () => Promise<unknown>) {
    setProgress('Preparing…')
    setError(null)
    try {
      await task()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.')
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap text-xs text-zinc-400">
      <span>
        {count} item{count === 1 ? '' : 's'} with a chosen image
      </span>
      <button
        type="button"
        disabled={count === 0 || progress !== null}
        onClick={() => run(() => exportZip(project, (done, total) => setProgress(`Rendering ${done}/${total}…`)))}
        className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg"
      >
        Download ZIP
      </button>
      <button
        type="button"
        disabled={count === 0 || progress !== null}
        onClick={() => run(() => printProject(project, widthMm))}
        className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg"
      >
        Print / PDF
      </button>
      <label className="flex items-center gap-1.5">
        width
        <input
          type="number"
          min={20}
          max={200}
          value={widthInput}
          onChange={(e) => setWidthInput(e.target.value)}
          className="w-14 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-200"
        />
        mm
      </label>
      {progress && <span className="text-violet-300">{progress}</span>}
      {error && <span className="text-red-400">{error}</span>}
    </div>
  )
}
