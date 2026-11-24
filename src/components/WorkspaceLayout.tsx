import type { ReactNode } from 'react'
import type { View } from '../workspace/types'
import { useWorkspace } from '../workspace/workspaceContext'
import { ProjectsView } from './projects/ProjectsView'

const TABS: { view: View; label: string }[] = [
  { view: 'studio', label: 'Studio' },
  { view: 'projects', label: 'Projects' },
]

interface WorkspaceLayoutProps {
  studio: ReactNode
  hasApiKey: boolean
}

export function WorkspaceLayout({ studio, hasApiKey }: WorkspaceLayoutProps) {
  const { state, actions } = useWorkspace()

  return (
    <div className="space-y-6">
      <nav className="flex gap-1 border-b border-zinc-800" aria-label="Workspace">
        {TABS.map((tab) => (
          <button
            key={tab.view}
            type="button"
            aria-current={state.view === tab.view ? 'page' : undefined}
            onClick={() => actions.setView(tab.view)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              state.view === tab.view
                ? 'border-violet-500 text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      {state.view === 'studio' ? studio : <ProjectsView hasApiKey={hasApiKey} />}
    </div>
  )
}
