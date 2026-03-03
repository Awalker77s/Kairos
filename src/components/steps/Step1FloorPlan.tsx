import { useState } from 'react'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { updateProject } from '../../lib/projects'
import { supabase } from '../../lib/supabase'
import type { Project } from '../../types/supabase'

type Step1FloorPlanProps = {
  project: Project
  onProjectChange: (project: Project) => void
}

const GEMINI_API_KEY = import.meta.env.VITE_GOOGLE_GEMINI_API_KEY as string

export function Step1FloorPlan({ project, onProjectChange }: Step1FloorPlanProps) {
  const [promptValue, setPromptValue] = useState(project.prompt)
  const [isSavingPrompt, setIsSavingPrompt] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasFloorPlan = Boolean(project.floor_plan_url)

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
    if (!promptValue.trim()) {
      setError('Please enter a building description before generating.')
      return
    }

    if (!GEMINI_API_KEY) {
      setError('Missing Google Gemini API key. Set VITE_GOOGLE_GEMINI_API_KEY in your environment.')
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) throw new Error('Not authenticated')

      // Generate the floor plan image with Imagen 2
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
      const model = genAI.getGenerativeModel({ model: 'imagen-3.0-generate-002' })

      const architecturalPrompt = `A clean professional 2D architectural floor plan for: "${promptValue.trim()}". Top-down view, black lines on white background, labeled rooms, thick lines for walls, door arcs, window markers, include room dimensions. Architectural blueprint style.`

      const result = await (model as any).generateImages({
        prompt: architecturalPrompt,
        numberOfImages: 1,
        aspectRatio: '1:1',
      })

      if (!result.images || result.images.length === 0) {
        throw new Error('Imagen API returned no images. Please try again.')
      }

      const imageBase64: string = result.images[0].imageBytes

      // Convert base64 to blob for upload
      const byteCharacters = atob(imageBase64)
      const byteNumbers = new Uint8Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const blob = new Blob([byteNumbers], { type: 'image/png' })

      // Upload to Supabase Storage
      const userId = session.user.id
      const storagePath = `${userId}/${project.id}/floor-plan.png`

      const { error: uploadError } = await supabase.storage
        .from('room-renders')
        .upload(storagePath, blob, {
          contentType: 'image/png',
          upsert: true,
        })

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`)
      }

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('room-renders')
        .getPublicUrl(storagePath)

      const floorPlanUrl = urlData.publicUrl

      // Update the project with the floor plan URL
      const updated = await updateProject(project.id, {
        prompt: promptValue.trim(),
        floor_plan_url: floorPlanUrl,
        status: 'floor_plan',
      })

      onProjectChange(updated)
    } catch (generationError) {
      const message = generationError instanceof Error ? generationError.message : 'Generation failed, please try again.'
      if (message.includes('API_KEY') || message.includes('api key') || message.includes('invalid key')) {
        setError('Imagen API error: invalid key. Check your VITE_GOOGLE_GEMINI_API_KEY.')
      } else {
        setError(message)
      }
    } finally {
      setIsGenerating(false)
    }
  }

  async function proceedToModel() {
    const updated = await updateProject(project.id, { status: '3d_model' })
    onProjectChange(updated)
  }

  return (
    <section className="space-y-5 rounded-2xl border border-warm-border bg-warm-white p-6 shadow-sm">
      <div>
        <label htmlFor="project-prompt" className="mb-2 block text-sm font-medium text-warm-black">
          Describe your building
        </label>
        <textarea
          id="project-prompt"
          value={promptValue}
          onChange={(event) => setPromptValue(event.target.value)}
          onBlur={savePrompt}
          rows={4}
          placeholder="e.g. Modern two story building with 3 bedrooms, open kitchen, and a garage"
          disabled={isGenerating}
          className="w-full rounded-xl border border-warm-border bg-cream px-4 py-3 text-sm text-warm-black outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30 disabled:opacity-60"
        />
        <p className="mt-2 text-xs text-warm-stone">{isSavingPrompt ? 'Saving prompt\u2026' : 'Prompt auto-saves on blur.'}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleGenerateFloorPlan}
          disabled={isGenerating}
          className="rounded-full bg-gold px-5 py-2 text-sm font-medium text-warm-black transition hover:bg-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isGenerating ? 'Generating\u2026' : 'Generate Floor Plan'}
        </button>

        <button
          type="button"
          onClick={proceedToModel}
          disabled={!hasFloorPlan}
          className="rounded-full border border-warm-border px-5 py-2 text-sm font-medium text-warm-black transition hover:border-gold disabled:cursor-not-allowed disabled:opacity-50"
        >
          Proceed to 3D Model
        </button>
      </div>

      {isGenerating && (
        <div className="flex items-center gap-3 rounded-xl border border-warm-border bg-cream px-4 py-3 text-sm text-warm-stone">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-gold border-t-transparent" />
          Generating floor plan&hellip;
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}

      {project.floor_plan_url ? (
        <div className="w-full max-w-[800px] overflow-hidden rounded-xl border border-warm-border bg-warm-white">
          <img
            src={project.floor_plan_url}
            alt="Generated 2D floor plan"
            className="h-auto w-full"
          />
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-warm-border bg-cream p-8 text-center text-warm-stone">
          Your generated floor plan will appear here.
        </div>
      )}
    </section>
  )
}
