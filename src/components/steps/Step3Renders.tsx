import { useEffect, useMemo, useState } from 'react'
import { updateProject } from '../../lib/projects'
import { getRendersByProject } from '../../lib/renders'
import { useAuth } from '../../context/AuthContext'
import { exportProjectPDF } from '../../lib/export'
import type { Project, RoomRender } from '../../types/supabase'

const styles = ['Modern', 'Scandinavian', 'Industrial', 'Mid-Century', 'Farmhouse', 'Luxury', 'Minimalist']

type RoomData = {
  id: string
  name: string
  type: string
}

type Step3RendersProps = {
  project: Project
  onProjectChange: (project: Project) => void
}

export function Step3Renders({ project, onProjectChange }: Step3RendersProps) {
  const { session } = useAuth()
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoadingRenders, setIsLoadingRenders] = useState(true)
  const [renders, setRenders] = useState<RoomRender[]>([])
  const [selectedRender, setSelectedRender] = useState<RoomRender | null>(null)
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
        const id = typeof roomRecord.id === 'string' ? roomRecord.id : null
        const name = typeof roomRecord.name === 'string' ? roomRecord.name : null
        const type = typeof roomRecord.type === 'string' ? roomRecord.type : 'Room'

        if (!id || !name) {
          return null
        }

        return { id, name, type }
      })
      .filter((room): room is RoomData => room !== null)
  }, [project.floor_plan_json])

  useEffect(() => {
    async function loadRenders() {
      setIsLoadingRenders(true)

      try {
        const existingRenders = await getRendersByProject(project.id)
        setRenders(existingRenders)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load existing renders.')
      } finally {
        setIsLoadingRenders(false)
      }
    }

    void loadRenders()
  }, [project.id])

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
    if (!session?.access_token) {
      setError('You must be signed in to generate renders.')
      return
    }

    setError(null)
    setIsGenerating(true)

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-room-renders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: project.id,
          style: project.style ?? styles[0],
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Render generation request failed.')
      }

      const nextRenders = Array.isArray(payload?.renders) ? (payload.renders as RoomRender[]) : []
      setRenders(nextRenders)

      if (project.status !== 'rendered') {
        const updated = await updateProject(project.id, { status: 'rendered' })
        onProjectChange(updated)
      }
    } catch (renderError) {
      setError(renderError instanceof Error ? renderError.message : 'Unable to generate room renders.')
    } finally {
      setIsGenerating(false)
    }
  }


  async function downloadPDFReport() {
    setError(null)
    try {
      await exportProjectPDF(project, renders)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Unable to export PDF report.')
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

  const renderByRoomName = useMemo(() => {
    return new Map(renders.map((render) => [render.room_name, render]))
  }, [renders])

  return (
    <section className="space-y-5 rounded-2xl border border-warm-border bg-warm-white p-6 shadow-sm">
      <div>
        <p className="mb-3 text-sm text-warm-stone">Pick a style to guide photorealistic room renders.</p>
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
                  isActive
                    ? 'border-gold bg-gold/15 text-warm-black'
                    : 'border-warm-border text-warm-stone hover:border-gold hover:text-warm-black'
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
          className="rounded-full border border-warm-border px-5 py-2 text-sm font-medium text-warm-black transition hover:border-gold"
        >
          Back to 3D Model
        </button>
        <button
          type="button"
          onClick={generateRoomRenders}
          disabled={isGenerating || rooms.length === 0}
          className="rounded-full bg-gold px-5 py-2 text-sm font-medium text-warm-black transition hover:bg-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isGenerating ? 'Generating\u2026' : 'Generate Room Renders'}
        </button>
        {renders.length > 0 && (
          <>
            <button
              type="button"
              onClick={generateRoomRenders}
              disabled={isGenerating}
              className="rounded-full border border-warm-border px-5 py-2 text-sm font-medium text-warm-black transition hover:border-gold disabled:cursor-not-allowed disabled:opacity-60"
            >
              Regenerate All
            </button>
            <button
              type="button"
              onClick={() => {
                void downloadPDFReport()
              }}
              className="rounded-full border border-warm-border px-5 py-2 text-sm font-medium text-warm-black transition hover:border-gold"
            >
              Download PDF Report
            </button>
          </>
        )}
      </div>

      {isLoadingRenders ? (
        <p className="text-sm text-warm-stone">Loading existing renders&hellip;</p>
      ) : rooms.length === 0 ? (
        <p className="text-sm text-warm-stone">No rooms available yet. Generate a floor plan first.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => {
            const render = renderByRoomName.get(room.name)

            if (isGenerating && !render) {
              return (
                <article key={room.id} className="rounded-xl border border-warm-border bg-cream p-4">
                  <h3 className="font-medium text-warm-black">{room.name}</h3>
                  <p className="mt-1 text-sm text-warm-stone">{room.type}</p>
                  <div className="mt-4 flex h-52 flex-col items-center justify-center rounded-lg border-2 border-dashed border-warm-border bg-warm-white text-warm-stone">
                    <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-warm-border border-t-gold" />
                    <p className="text-xs">Generating render&hellip;</p>
                  </div>
                </article>
              )
            }

            return (
              <article
                key={room.id}
                className="cursor-pointer rounded-xl border border-warm-border bg-cream p-3 transition hover:border-gold hover:shadow-md"
                onClick={() => {
                  if (render?.image_url) {
                    setSelectedRender(render)
                  }
                }}
              >
                <div className="aspect-square overflow-hidden rounded-lg bg-cream-dark">
                  {render?.image_url ? (
                    <img src={render.image_url} alt={room.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-warm-stone">No render yet</div>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-medium text-warm-black">{room.name}</h3>
                    <p className="text-sm text-warm-stone">{room.type}</p>
                  </div>
                  {render?.image_url && (
                    <a
                      href={render.image_url}
                      download={`${room.name.replaceAll(' ', '-').toLowerCase()}.png`}
                      onClick={(event) => {
                        event.stopPropagation()
                      }}
                      className="rounded-full border border-warm-border px-3 py-1.5 text-xs text-warm-black transition hover:border-gold"
                    >
                      Download
                    </a>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {selectedRender?.image_url && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSelectedRender(null)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
              setSelectedRender(null)
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-warm-black/80 p-6 backdrop-blur-sm"
        >
          <div className="max-h-full w-full max-w-4xl overflow-auto rounded-xl border border-warm-border bg-warm-white p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-serif text-lg font-semibold text-warm-black">{selectedRender.room_name}</h3>
                <p className="mt-1 text-xs text-warm-stone">{selectedRender.prompt_used}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRender(null)}
                className="rounded-full border border-warm-border px-3 py-1 text-xs text-warm-black transition hover:border-gold"
              >
                Close
              </button>
            </div>
            <img src={selectedRender.image_url} alt={selectedRender.room_name} className="w-full rounded-lg object-contain" />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
    </section>
  )
}
