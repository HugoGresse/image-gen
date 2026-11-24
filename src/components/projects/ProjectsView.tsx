import { formatCost } from '../../lib/money'
import { projectCost } from '../../workspace/cost'
import { activeProject, projectLabel } from '../../workspace/reducer'
import { useWorkspace } from '../../workspace/workspaceContext'
import { CardBoard } from './CardBoard'
import { ProjectSettingsPanel } from './ProjectSettingsPanel'
import { FrameSettingsPanel } from './FrameSettingsPanel'
import { ExportBar } from './ExportBar'

export function ProjectsView({ hasApiKey }: { hasApiKey: boolean }) {
  const { state, actions } = useWorkspace()
  const project = activeProject(state)
  const spent = project ? formatCost(projectCost(project)) : null

  function handleDelete() {
    if (!project) return
    if (window.confirm(`Delete "${projectLabel(project)}" and its ${project.cards.length} items? This cannot be undone.`)) {
      actions.deleteProject(project.id)
    }
  }

  if (!state.loaded) return <p className="text-sm text-zinc-500">Loading projects…</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        {state.projects.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={p.id === project?.id}
            onClick={() => actions.selectProject(p.id)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              p.id === project?.id ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {projectLabel(p)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => actions.createProject(`Project ${state.projects.length + 1}`)}
          className="px-3 py-1.5 rounded-lg text-sm border border-dashed border-zinc-700 text-zinc-400 hover:border-violet-500 hover:text-violet-300"
        >
          + New project
        </button>
      </div>

      {project ? (
        <>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <ProjectSettingsPanel project={project} />
            <div className="mt-4 pt-4 border-t border-zinc-800">
              <FrameSettingsPanel project={project} />
            </div>
            <div className="mt-4 pt-4 border-t border-zinc-800">
              <ExportBar project={project} />
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-800 text-xs text-zinc-500">
              <span>
                {project.cards.length} items{spent && ` · ${spent} spent`}
              </span>
              <button type="button" onClick={handleDelete} className="hover:text-red-400">
                Delete project
              </button>
            </div>
          </div>
          <CardBoard project={project} canGenerate={hasApiKey} />
        </>
      ) : (
        <p className="text-sm text-zinc-500 text-center py-16">
          A project keeps a style guide, references and a fixed model so a whole series looks consistent.
        </p>
      )}
    </div>
  )
}
