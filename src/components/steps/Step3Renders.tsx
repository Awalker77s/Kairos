import { useMemo, useState } from 'react'
import { updateProject } from '../../lib/projects'
import type { Project } from '../../types/supabase'

const styles = ['Modern', 'Scandinavian', 'Industrial', 'Mid-Century', 'Farmhouse', 'Luxury', 'Minimalist']

type RoomData = {
  name: string
  type: string
}

type Step3RendersProps = {
  project: Project
  onProjectChange: (project: Project) => void
}

export function Step3Renders({ project, onProjectChange }: Step3RendersProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rooms = useMemo(() => {
    const roomsRaw = project.floor_plan_json && 'rooms' in project.floor_plan_json ? project.floor_plan_json.rooms : null

    if (!Array.isArray(roomsRaw)) {
      return []
    }

    return roomsRaw
      .map((room) => {
        if (typeof room !== 'object' || room === null) {
          return null
        }

        const roomRecord = room as Record<string, unknown>
        const name = typeof roomRecord.name === 'string' ? roomRecord.name : null
        const type = typeof roomRecord.type === 'string' ? roomRecord.type : 'Room'

        if (!name) {
          return null
        }

        return { name, type }
      })
      .filter((room): room is RoomData => room !== null)
  }, [project.floor_plan_json])

  async function selectStyle(style: string) {
    if (style === project.style) {
      return
    }

    setError(null)

    try {
      const updated = await updateProject(project.id, { style })
      onProjectChange(updated)
    } catch (styleError) {
      setError(styleError instanceof Error ? styleError.message : 'Unable to save style selection.')
    }
  }

  async function generateRoomRenders() {
    setError(null)
    setIsGenerating(true)

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-room-renders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: project.id,
          style: project.style,
        }),
      })

      if (!response.ok) {
        throw new Error('Render generation request failed.')
      }
    } catch (renderError) {
      setError(renderError instanceof Error ? renderError.message : 'Unable to generate room renders.')
    } finally {
      setIsGenerating(false)
    }
  }

  async function goBackToModelStep() {
    setError(null)
    try {
      const updated = await updateProject(project.id, { status: '3d_model' })
      onProjectChange(updated)
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Unable to return to 3D model step.')
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-white/10 bg-black/20 p-6">
      <div>
        <p className="mb-3 text-sm text-stone">Pick a style to guide photorealistic room renders.</p>
        <div className="flex flex-wrap gap-2">
          {styles.map((style) => {
            const isActive = style === project.style
            return (
              <button
                key={style}
                type="button"
                onClick={() => {
                  void selectStyle(style)
                }}
                className={`rounded-full border px-4 py-1.5 text-sm transition ${
                  isActive ? 'border-brand bg-brand/20 text-white' : 'border-white/20 text-stone hover:border-white/40 hover:text-white'
                }`}
              >
                {style}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={goBackToModelStep}
          className="rounded-full border border-white/20 px-5 py-2 text-sm font-medium text-white"
        >
          Back to 3D Model
        </button>
        <button
          type="button"
          onClick={generateRoomRenders}
          disabled={isGenerating}
          className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isGenerating ? 'Generating…' : 'Generate Room Renders'}
        </button>
      </div>

      {rooms.length === 0 ? (
        <p className="text-sm text-stone">No rooms available yet. Generate a floor plan first.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => (
            <article key={room.name} className="rounded-xl border border-white/15 bg-white/5 p-4">
              <h3 className="font-medium text-white">{room.name}</h3>
              <p className="mt-1 text-sm text-stone">{room.type}</p>
              <div className="mt-4 rounded-lg border border-dashed border-white/20 bg-black/20 p-6 text-center text-xs text-stone">
                Render placeholder
              </div>
            </article>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-300">{error}</p>}
    </section>
  )
}
