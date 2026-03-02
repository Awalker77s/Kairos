import { useState } from 'react'
import { updateProject } from '../../lib/projects'
import type { Project } from '../../types/supabase'

type Step2Model3DProps = {
  project: Project
  onProjectChange: (project: Project) => void
}

export function Step2Model3D({ project, onProjectChange }: Step2Model3DProps) {
  const [error, setError] = useState<string | null>(null)

  async function goToStep3() {
    setError(null)
    try {
      const updated = await updateProject(project.id, { status: 'rendered' })
      onProjectChange(updated)
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Unable to advance to room renders.')
    }
  }

  async function goBackToStep1() {
    setError(null)
    try {
      const updated = await updateProject(project.id, { status: 'floor_plan' })
      onProjectChange(updated)
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Unable to return to floor plan step.')
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-white/10 bg-black/20 p-6">
      <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-10 text-center text-stone">
        3D Viewer — coming next
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={goBackToStep1}
          className="rounded-full border border-white/20 px-5 py-2 text-sm font-medium text-white"
        >
          Back to Floor Plan
        </button>
        <button
          type="button"
          onClick={goToStep3}
          className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-black"
        >
          Proceed to Room Renders
        </button>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}
    </section>
  )
}
