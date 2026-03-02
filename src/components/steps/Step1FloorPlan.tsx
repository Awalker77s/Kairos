import { useState } from 'react'
import { updateProject } from '../../lib/projects'
import { supabase } from '../../lib/supabase'
import { FloorPlanCanvas } from '../FloorPlanCanvas'
import type { Project } from '../../types/supabase'

type Step1FloorPlanProps = {
  project: Project
  onProjectChange: (project: Project) => void
}

type FloorPlanResponse = Record<string, unknown>

export function Step1FloorPlan({ project, onProjectChange }: Step1FloorPlanProps) {
  const [promptValue, setPromptValue] = useState(project.prompt)
  const [isSavingPrompt, setIsSavingPrompt] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasFloorPlan = Boolean(project.floor_plan_json)

  async function savePrompt() {
    if (promptValue.trim() === project.prompt) {
      return
    }

    setIsSavingPrompt(true)
    setError(null)

    try {
      const updated = await updateProject(project.id, { prompt: promptValue.trim() })
      onProjectChange(updated)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save prompt.')
      setPromptValue(project.prompt)
    } finally {
      setIsSavingPrompt(false)
    }
  }

  async function handleGenerateFloorPlan() {
    setIsGenerating(true)
    setError(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('You must be signed in to generate a floor plan.')
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-floor-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          projectId: project.id,
          prompt: promptValue,
        }),
      })

      if (!response.ok) {
        throw new Error('Floor plan generation request failed.')
      }

      const result = (await response.json()) as FloorPlanResponse

      if (!Array.isArray(result.rooms)) {
        throw new Error('Missing floor plan payload from generator.')
      }

      const updated = await updateProject(project.id, {
        prompt: promptValue.trim(),
        floor_plan_json: result,
        status: 'floor_plan',
      })

      onProjectChange(updated)
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Unable to generate floor plan.')
    } finally {
      setIsGenerating(false)
    }
  }

  async function proceedToModel() {
    const updated = await updateProject(project.id, { status: '3d_model' })
    onProjectChange(updated)
  }

  return (
    <section className="space-y-5 rounded-2xl border border-white/10 bg-black/20 p-6">
      <div>
        <label htmlFor="project-prompt" className="mb-2 block text-sm font-medium text-white">
          Initial prompt
        </label>
        <textarea
          id="project-prompt"
          value={promptValue}
          onChange={(event) => setPromptValue(event.target.value)}
          onBlur={savePrompt}
          rows={6}
          className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none ring-brand/70 transition focus:ring"
        />
        <p className="mt-2 text-xs text-stone">{isSavingPrompt ? 'Saving prompt…' : 'Prompt auto-saves on blur.'}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleGenerateFloorPlan}
          disabled={isGenerating}
          className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          Generate Floor Plan
        </button>

        <button
          type="button"
          onClick={proceedToModel}
          disabled={!hasFloorPlan}
          className="rounded-full border border-white/20 px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Proceed to 3D Model
        </button>
      </div>

      {isGenerating && (
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-stone">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          Generating your floor plan…
        </div>
      )}

      {error && <p className="text-sm text-red-300">{error}</p>}

      {project.floor_plan_json ? (
        <FloorPlanCanvas floorPlanJson={project.floor_plan_json} />
      ) : (
        <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-8 text-center text-stone">
          Your generated floor plan will appear here.
        </div>
      )}
    </section>
  )
}
