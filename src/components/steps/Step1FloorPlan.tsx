import { useMemo, useState } from 'react'
import { updateProject } from '../../lib/projects'
import { supabase } from '../../lib/supabase'
import type { Project } from '../../types/supabase'

type Step1FloorPlanProps = {
  project: Project
  onProjectChange: (project: Project) => void
}

type FloorPlanResponse = Record<string, unknown>
type UnknownRecord = Record<string, unknown>

type NormalizedRoom = {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
}

type NormalizedWall = {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
}

type WallEdge = 'top' | 'bottom' | 'left' | 'right'

type NormalizedOpening = {
  id: string
  roomId?: string
  wall?: WallEdge
  position?: number
  width?: number
  x1?: number
  y1?: number
  x2?: number
  y2?: number
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function normalizeRooms(rooms: unknown): NormalizedRoom[] {
  if (!Array.isArray(rooms)) return []

  return rooms
    .map((room, index) => {
      if (!room || typeof room !== 'object') return null
      const item = room as UnknownRecord

      const x = asNumber(item.x) ?? asNumber(item.left) ?? asNumber(item.x1)
      const y = asNumber(item.y) ?? asNumber(item.top) ?? asNumber(item.y1)

      const width =
        asNumber(item.width) ??
        ((asNumber(item.x2) !== null && x !== null ? asNumber(item.x2)! - x : null) ??
          (asNumber(item.right) !== null && x !== null ? asNumber(item.right)! - x : null))

      const height =
        asNumber(item.height) ??
        ((asNumber(item.y2) !== null && y !== null ? asNumber(item.y2)! - y : null) ??
          (asNumber(item.bottom) !== null && y !== null ? asNumber(item.bottom)! - y : null))

      if (x === null || y === null || width === null || height === null || width <= 0 || height <= 0) {
        return null
      }

      return {
        id: String(item.id ?? `room-${index}`),
        name: String(item.name ?? item.label ?? `Room ${index + 1}`),
        x,
        y,
        width,
        height,
      }
    })
    .filter((room): room is NormalizedRoom => room !== null)
}

function normalizeWalls(walls: unknown): NormalizedWall[] {
  if (!Array.isArray(walls)) return []

  return walls
    .map((wall, index) => {
      if (!wall || typeof wall !== 'object') return null
      const item = wall as UnknownRecord

      const start = (item.start ?? item.from) as UnknownRecord | undefined
      const end = (item.end ?? item.to) as UnknownRecord | undefined

      const x1 = asNumber(item.x1) ?? asNumber(start?.x)
      const y1 = asNumber(item.y1) ?? asNumber(start?.y)
      const x2 = asNumber(item.x2) ?? asNumber(end?.x)
      const y2 = asNumber(item.y2) ?? asNumber(end?.y)

      if (x1 === null || y1 === null || x2 === null || y2 === null) return null

      return { id: String(item.id ?? `wall-${index}`), x1, y1, x2, y2 }
    })
    .filter((wall): wall is NormalizedWall => wall !== null)
}

function normalizeOpenings(openings: unknown, kind: 'door' | 'window'): NormalizedOpening[] {
  if (!Array.isArray(openings)) return []

  return openings.reduce<NormalizedOpening[]>((acc, opening, index) => {
    if (!opening || typeof opening !== 'object') return acc
    const item = opening as UnknownRecord

    const wall = item.wall
    const normalizedWall: WallEdge | undefined =
      wall === 'top' || wall === 'bottom' || wall === 'left' || wall === 'right' ? wall : undefined

    const x1 = asNumber(item.x1)
    const y1 = asNumber(item.y1)
    const x2 = asNumber(item.x2)
    const y2 = asNumber(item.y2)

    acc.push({
      id: String(item.id ?? `${kind}-${index}`),
      roomId: item.roomId ? String(item.roomId) : item.room_id ? String(item.room_id) : undefined,
      wall: normalizedWall,
      position: asNumber(item.position) ?? undefined,
      width: asNumber(item.width) ?? undefined,
      x1: x1 ?? undefined,
      y1: y1 ?? undefined,
      x2: x2 ?? undefined,
      y2: y2 ?? undefined,
    })

    return acc
  }, [])
}

function openingSegment(opening: NormalizedOpening, roomsById: Map<string, NormalizedRoom>) {
  if (
    opening.x1 !== undefined &&
    opening.y1 !== undefined &&
    opening.x2 !== undefined &&
    opening.y2 !== undefined
  ) {
    return { x1: opening.x1, y1: opening.y1, x2: opening.x2, y2: opening.y2 }
  }

  if (!opening.roomId || !opening.wall || opening.position === undefined || opening.width === undefined) {
    return null
  }

  const room = roomsById.get(opening.roomId)
  if (!room) return null

  const start = opening.position
  const end = opening.position + opening.width

  if (opening.wall === 'top') {
    return { x1: room.x + start, y1: room.y, x2: room.x + end, y2: room.y }
  }

  if (opening.wall === 'bottom') {
    return { x1: room.x + start, y1: room.y + room.height, x2: room.x + end, y2: room.y + room.height }
  }

  if (opening.wall === 'left') {
    return { x1: room.x, y1: room.y + start, x2: room.x, y2: room.y + end }
  }

  return { x1: room.x + room.width, y1: room.y + start, x2: room.x + room.width, y2: room.y + end }
}

function floorPlanBounds(rooms: NormalizedRoom[], walls: NormalizedWall[]) {
  const xs: number[] = []
  const ys: number[] = []

  walls.forEach((wall) => {
    xs.push(wall.x1, wall.x2)
    ys.push(wall.y1, wall.y2)
  })

  rooms.forEach((room) => {
    xs.push(room.x, room.x + room.width)
    ys.push(room.y, room.y + room.height)
  })

  if (!xs.length || !ys.length) {
    return { minX: 0, minY: 0, width: 100, height: 100 }
  }

  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  return {
    minX,
    minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  }
}

function FloorPlanSvg({ floorPlanJson }: { floorPlanJson: FloorPlanResponse }) {
  const rooms = normalizeRooms(floorPlanJson.rooms)
  const walls = normalizeWalls(floorPlanJson.walls)
  const doors = normalizeOpenings(floorPlanJson.doors, 'door')
  const windows = normalizeOpenings(floorPlanJson.windows, 'window')

  const roomsById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms])

  if (!rooms.length && !walls.length) {
    return (
      <div className="rounded-xl border border-warm-border bg-cream p-6 text-sm text-warm-stone">
        Floor plan data is missing room and wall geometry.
      </div>
    )
  }

  const bounds = floorPlanBounds(rooms, walls)
  const padding = Math.max(bounds.width, bounds.height) * 0.08
  const viewBoxX = bounds.minX - padding
  const viewBoxY = bounds.minY - padding
  const viewBoxWidth = bounds.width + padding * 2
  const viewBoxHeight = bounds.height + padding * 2

  const base = Math.max(bounds.width, bounds.height)
  const wallStroke = Math.max(base * 0.008, 0.8)
  const roomStroke = Math.max(base * 0.0035, 0.5)
  const windowStroke = Math.max(base * 0.003, 0.4)
  const doorStroke = Math.max(base * 0.003, 0.4)
  const labelSize = Math.max(base * 0.03, 2.8)

  return (
    <div className="w-full overflow-hidden rounded-xl border border-warm-border bg-warm-white p-3">
      <svg
        className="h-auto w-full"
        viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Generated floor plan"
      >
        <rect x={viewBoxX} y={viewBoxY} width={viewBoxWidth} height={viewBoxHeight} fill="#F8F4ED" />

        {rooms.map((room) => (
          <g key={room.id}>
            <rect
              x={room.x}
              y={room.y}
              width={room.width}
              height={room.height}
              fill="#FAF7F2"
              stroke="#B79035"
              strokeWidth={roomStroke}
              rx={Math.max(base * 0.005, 0.8)}
            />
            <text
              x={room.x + room.width / 2}
              y={room.y + room.height / 2}
              fontSize={labelSize}
              fill="#1C1410"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {room.name}
            </text>
          </g>
        ))}

        {walls.map((wall) => (
          <line
            key={wall.id}
            x1={wall.x1}
            y1={wall.y1}
            x2={wall.x2}
            y2={wall.y2}
            stroke="#241914"
            strokeWidth={wallStroke}
            strokeLinecap="round"
          />
        ))}

        {doors.map((door) => {
          const segment = openingSegment(door, roomsById)
          if (!segment) return null

          const dx = segment.x2 - segment.x1
          const dy = segment.y2 - segment.y1
          const width = Math.hypot(dx, dy)
          if (width === 0) return null

          const radius = width * 0.9
          const sweep = dx >= 0 || dy >= 0 ? 1 : 0

          return (
            <g key={door.id}>
              <line
                x1={segment.x1}
                y1={segment.y1}
                x2={segment.x2}
                y2={segment.y2}
                stroke="#F8F4ED"
                strokeWidth={wallStroke * 1.4}
                strokeLinecap="round"
              />
              <path
                d={`M ${segment.x1} ${segment.y1} A ${radius} ${radius} 0 0 ${sweep} ${segment.x2} ${segment.y2}`}
                fill="none"
                stroke="#6B3F2A"
                strokeWidth={doorStroke}
              />
            </g>
          )
        })}

        {windows.map((windowItem) => {
          const segment = openingSegment(windowItem, roomsById)
          if (!segment) return null

          const dx = segment.x2 - segment.x1
          const dy = segment.y2 - segment.y1
          const length = Math.hypot(dx, dy)
          if (length === 0) return null

          const nx = -dy / length
          const ny = dx / length
          const offset = Math.max(base * 0.006, 0.8)

          return (
            <g key={windowItem.id}>
              <line
                x1={segment.x1 + nx * offset}
                y1={segment.y1 + ny * offset}
                x2={segment.x2 + nx * offset}
                y2={segment.y2 + ny * offset}
                stroke="#507A9A"
                strokeWidth={windowStroke}
                strokeLinecap="round"
              />
              <line
                x1={segment.x1 - nx * offset}
                y1={segment.y1 - ny * offset}
                x2={segment.x2 - nx * offset}
                y2={segment.y2 - ny * offset}
                stroke="#507A9A"
                strokeWidth={windowStroke}
                strokeLinecap="round"
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

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

      if (!session) throw new Error('Not authenticated')

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-floor-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
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
      console.log('generate-floor-plan raw response', result)

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
    <section className="space-y-5 rounded-2xl border border-warm-border bg-warm-white p-6 shadow-sm">
      <div>
        <label htmlFor="project-prompt" className="mb-2 block text-sm font-medium text-warm-black">
          Initial prompt
        </label>
        <textarea
          id="project-prompt"
          value={promptValue}
          onChange={(event) => setPromptValue(event.target.value)}
          onBlur={savePrompt}
          rows={6}
          className="w-full rounded-xl border border-warm-border bg-cream px-4 py-3 text-sm text-warm-black outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
        />
        <p className="mt-2 text-xs text-warm-stone">{isSavingPrompt ? 'Saving prompt…' : 'Prompt auto-saves on blur.'}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleGenerateFloorPlan}
          disabled={isGenerating}
          className="rounded-full bg-gold px-5 py-2 text-sm font-medium text-warm-black transition hover:bg-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          Generate Floor Plan
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
          Generating your floor plan&hellip;
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}

      {project.floor_plan_json ? (
        <FloorPlanSvg floorPlanJson={project.floor_plan_json as FloorPlanResponse} />
      ) : (
        <div className="rounded-xl border-2 border-dashed border-warm-border bg-cream p-8 text-center text-warm-stone">
          Your generated floor plan will appear here.
        </div>
      )}
    </section>
  )
}
