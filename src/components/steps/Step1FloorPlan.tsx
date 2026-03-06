import { useMemo, useState } from 'react'
import { updateProject } from '../../lib/projects'
import { supabase } from '../../lib/supabase'
import type { Project } from '../../types/supabase'

type Step1FloorPlanProps = {
  project: Project
  onProjectChange: (project: Project) => void
}

type UnknownRecord = Record<string, unknown>
type FloorPlanResponse = Record<string, unknown>

type Room = {
  id: string
  name: string
  type: string
  x: number
  y: number
  width: number
  height: number
  floor: number
  material: string
  furniture: string[]
}

type Wall = {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  wallType: 'exterior' | 'interior'
  measurement?: string
}

type Opening = {
  id: string
  type: 'door' | 'window'
  x1: number
  y1: number
  x2: number
  y2: number
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function formatFeet(value: number): string {
  const wholeFeet = Math.floor(Math.max(0, value))
  const inches = Math.round((value - wholeFeet) * 12)
  if (inches === 0) return `${wholeFeet}'-0\"`
  return `${wholeFeet}'-${inches}\"`
}

function parseFloorPlan(data: FloorPlanResponse): { floors: number[]; rooms: Room[]; walls: Wall[]; openings: Opening[] } {
  const rooms: Room[] = []
  const walls: Wall[] = []
  const openings: Opening[] = []

  const addRoom = (room: unknown, floorNum: number, index: number) => {
    if (!room || typeof room !== 'object') return
    const value = room as UnknownRecord
    const x = asNumber(value.x)
    const y = asNumber(value.y)
    const width = asNumber(value.width)
    const height = asNumber(value.height)
    if (x === null || y === null || width === null || height === null || width <= 0 || height <= 0) return

    rooms.push({
      id: String(value.id ?? `room-${floorNum}-${index}`),
      name: String(value.name ?? `Room ${index + 1}`),
      type: String(value.type ?? 'other'),
      x,
      y,
      width,
      height,
      floor: asNumber(value.floor) ?? floorNum,
      material: String(value.material ?? 'UNSPECIFIED').toUpperCase(),
      furniture: Array.isArray(value.furniture) ? value.furniture.filter((f): f is string => typeof f === 'string') : [],
    })
  }

  const building = data.building as UnknownRecord | undefined
  if (building && Array.isArray(building.floors)) {
    ;(building.floors as unknown[]).forEach((floorRaw, floorIndex) => {
      if (!floorRaw || typeof floorRaw !== 'object') return
      const floor = floorRaw as UnknownRecord
      const floorNumber = asNumber(floor.floorNumber) ?? floorIndex + 1
      if (Array.isArray(floor.rooms)) {
        floor.rooms.forEach((room, roomIndex) => addRoom(room, floorNumber, roomIndex))
      }
    })
  }

  if (!rooms.length && Array.isArray(data.rooms)) {
    data.rooms.forEach((room, index) => {
      if (!room || typeof room !== 'object') return
      const floor = asNumber((room as UnknownRecord).floor) ?? 1
      addRoom(room, floor, index)
    })
  }

  const addWall = (wall: unknown, index: number) => {
    if (!wall || typeof wall !== 'object') return
    const value = wall as UnknownRecord
    const x1 = asNumber(value.x1)
    const y1 = asNumber(value.y1)
    const x2 = asNumber(value.x2)
    const y2 = asNumber(value.y2)
    if (x1 === null || y1 === null || x2 === null || y2 === null) return

    walls.push({
      id: String(value.id ?? `wall-${index}`),
      x1,
      y1,
      x2,
      y2,
      wallType: value.wallType === 'interior' ? 'interior' : 'exterior',
      measurement: typeof value.measurement === 'string' ? value.measurement : undefined,
    })
  }

  if (Array.isArray(data.walls)) data.walls.forEach(addWall)

  const addOpening = (opening: unknown, type: 'door' | 'window', index: number) => {
    if (!opening || typeof opening !== 'object') return
    const value = opening as UnknownRecord
    const x1 = asNumber(value.x1)
    const y1 = asNumber(value.y1)
    const x2 = asNumber(value.x2)
    const y2 = asNumber(value.y2)
    if (x1 === null || y1 === null || x2 === null || y2 === null) return
    openings.push({ id: String(value.id ?? `${type}-${index}`), type, x1, y1, x2, y2 })
  }

  if (Array.isArray(data.doors)) data.doors.forEach((item, index) => addOpening(item, 'door', index))
  if (Array.isArray(data.windows)) data.windows.forEach((item, index) => addOpening(item, 'window', index))

  const floors = Array.from(new Set(rooms.map((room) => room.floor))).sort((a, b) => a - b)
  return { floors: floors.length ? floors : [1], rooms, walls, openings }
}

function drawFurniture(room: Room, strokeWidth: number) {
  const cx = room.x + room.width / 2
  const cy = room.y + room.height / 2
  const inset = Math.min(room.width, room.height) * 0.15
  const items = room.furniture

  const has = (name: string) => items.includes(name)

  if (has('sofa') || room.type === 'living') {
    return (
      <g>
        <rect x={cx - room.width * 0.22} y={cy - room.height * 0.12} width={room.width * 0.44} height={room.height * 0.24} fill="none" stroke="#000" strokeWidth={strokeWidth} />
        <rect x={cx - room.width * 0.18} y={cy - room.height * 0.08} width={room.width * 0.36} height={room.height * 0.16} fill="none" stroke="#000" strokeWidth={strokeWidth * 0.8} />
      </g>
    )
  }

  if (has('bed_queen') || has('bed_king') || room.type === 'bedroom') {
    return (
      <g>
        <rect x={room.x + inset} y={room.y + inset} width={room.width - inset * 2} height={room.height * 0.5} fill="none" stroke="#000" strokeWidth={strokeWidth} />
        <rect x={room.x + inset * 1.2} y={room.y + inset * 1.2} width={room.width * 0.22} height={room.height * 0.1} fill="none" stroke="#000" strokeWidth={strokeWidth * 0.8} />
        <rect x={room.x + room.width - inset * 1.2 - room.width * 0.22} y={room.y + inset * 1.2} width={room.width * 0.22} height={room.height * 0.1} fill="none" stroke="#000" strokeWidth={strokeWidth * 0.8} />
      </g>
    )
  }

  if (has('toilet') || has('sink') || room.type === 'bathroom') {
    return (
      <g>
        <ellipse cx={room.x + room.width * 0.32} cy={cy} rx={room.width * 0.09} ry={room.height * 0.13} fill="none" stroke="#000" strokeWidth={strokeWidth} />
        <rect x={room.x + room.width * 0.56} y={cy - room.height * 0.12} width={room.width * 0.24} height={room.height * 0.24} fill="none" stroke="#000" strokeWidth={strokeWidth} />
      </g>
    )
  }

  if (has('counter_l') || room.type === 'kitchen') {
    const x = room.x + inset
    const y = room.y + inset
    const w = room.width - inset * 2
    const h = room.height - inset * 2
    return <path d={`M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h * 0.24} L ${x + w * 0.28} ${y + h * 0.24} L ${x + w * 0.28} ${y + h} L ${x} ${y + h} Z`} fill="none" stroke="#000" strokeWidth={strokeWidth} />
  }

  return null
}

function BlueprintSvg({ floorPlanJson, projectTitle }: { floorPlanJson: FloorPlanResponse; projectTitle: string }) {
  const parsed = useMemo(() => parseFloorPlan(floorPlanJson), [floorPlanJson])
  const [selectedFloor, setSelectedFloor] = useState(parsed.floors[0])

  const currentRooms = parsed.rooms.filter((room) => room.floor === selectedFloor)
  const currentWalls = parsed.walls.filter((wall) => {
    const minX = Math.min(wall.x1, wall.x2)
    const maxX = Math.max(wall.x1, wall.x2)
    const minY = Math.min(wall.y1, wall.y2)
    const maxY = Math.max(wall.y1, wall.y2)
    return currentRooms.some((room) => minX <= room.x + room.width && maxX >= room.x && minY <= room.y + room.height && maxY >= room.y)
  })
  const currentOpenings = parsed.openings.filter((opening) => {
    const minX = Math.min(opening.x1, opening.x2)
    const maxX = Math.max(opening.x1, opening.x2)
    const minY = Math.min(opening.y1, opening.y2)
    const maxY = Math.max(opening.y1, opening.y2)
    return currentRooms.some((room) => minX <= room.x + room.width && maxX >= room.x && minY <= room.y + room.height && maxY >= room.y)
  })

  if (!currentRooms.length) {
    return <div className="rounded-xl border border-warm-border bg-cream p-6 text-sm text-warm-stone">No drawable floor plan geometry found.</div>
  }

  const minX = Math.min(...currentRooms.map((room) => room.x))
  const minY = Math.min(...currentRooms.map((room) => room.y))
  const maxX = Math.max(...currentRooms.map((room) => room.x + room.width))
  const maxY = Math.max(...currentRooms.map((room) => room.y + room.height))

  const width = maxX - minX
  const height = maxY - minY
  const dimOffset = Math.max(width, height) * 0.12
  const titleBlockH = Math.max(width, height) * 0.2
  const pad = dimOffset * 1.3

  const viewBoxX = minX - pad
  const viewBoxY = minY - pad
  const viewBoxW = width + pad * 2
  const viewBoxH = height + pad * 2 + titleBlockH

  const exteriorStroke = Math.max(width, height) * 0.01
  const interiorStroke = Math.max(width, height) * 0.0055
  const detailStroke = Math.max(width, height) * 0.0022
  const tick = Math.max(width, height) * 0.014

  const overallWidthLabel = formatFeet(width)
  const overallHeightLabel = formatFeet(height)

  const stairRoom = currentRooms.find((room) => room.type.toLowerCase().includes('stair') || room.furniture.some((item) => item.includes('stair')))

  return (
    <div className="w-full overflow-hidden rounded-xl border border-warm-border bg-[#f5f0e8]">
      {parsed.floors.length > 1 && (
        <div className="flex gap-2 border-b border-warm-border px-4 py-3">
          {parsed.floors.map((floor) => (
            <button
              key={floor}
              type="button"
              onClick={() => setSelectedFloor(floor)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${selectedFloor === floor ? 'bg-warm-black text-white' : 'border border-warm-border bg-white text-warm-black'}`}
            >
              Floor {floor}
            </button>
          ))}
        </div>
      )}

      <div className="p-3">
        <svg className="h-auto w-full" viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxW} ${viewBoxH}`} role="img" aria-label="Architectural floor plan" style={{ fontFamily: "'Arial Narrow', Arial, sans-serif" }}>
          <rect x={viewBoxX} y={viewBoxY} width={viewBoxW} height={viewBoxH} fill="#f5f0e8" />

          {currentRooms.map((room) => (
            <rect key={`room-${room.id}`} x={room.x} y={room.y} width={room.width} height={room.height} fill="none" stroke="#000" strokeWidth={detailStroke} />
          ))}

          {currentWalls.map((wall) => (
            <line
              key={wall.id}
              x1={wall.x1}
              y1={wall.y1}
              x2={wall.x2}
              y2={wall.y2}
              stroke="#000"
              strokeWidth={wall.wallType === 'exterior' ? exteriorStroke : interiorStroke}
              strokeLinecap="square"
            />
          ))}

          {currentOpenings.map((opening) => {
            const dx = opening.x2 - opening.x1
            const dy = opening.y2 - opening.y1
            const len = Math.hypot(dx, dy) || 1
            const nx = -dy / len
            const ny = dx / len

            if (opening.type === 'window') {
              const offset = detailStroke * 2
              return (
                <g key={opening.id}>
                  <line x1={opening.x1 + nx * offset} y1={opening.y1 + ny * offset} x2={opening.x2 + nx * offset} y2={opening.y2 + ny * offset} stroke="#000" strokeWidth={detailStroke} />
                  <line x1={opening.x1} y1={opening.y1} x2={opening.x2} y2={opening.y2} stroke="#000" strokeWidth={detailStroke} />
                  <line x1={opening.x1 - nx * offset} y1={opening.y1 - ny * offset} x2={opening.x2 - nx * offset} y2={opening.y2 - ny * offset} stroke="#000" strokeWidth={detailStroke} />
                </g>
              )
            }

            const radius = len
            const arcEndX = opening.x1 + ny * radius
            const arcEndY = opening.y1 - nx * radius
            return (
              <g key={opening.id}>
                <line x1={opening.x1} y1={opening.y1} x2={arcEndX} y2={arcEndY} stroke="#000" strokeWidth={detailStroke} />
                <path d={`M ${arcEndX} ${arcEndY} A ${radius} ${radius} 0 0 1 ${opening.x2} ${opening.y2}`} fill="none" stroke="#000" strokeWidth={detailStroke} strokeDasharray={`${detailStroke * 4} ${detailStroke * 2}`} />
              </g>
            )
          })}

          {currentWalls.map((wall) => {
            const mx = (wall.x1 + wall.x2) / 2
            const my = (wall.y1 + wall.y2) / 2
            const horizontal = Math.abs(wall.y2 - wall.y1) < 0.0001
            const offset = dimOffset * 0.35
            const y = horizontal ? (wall.y1 < minY + height / 2 ? minY - offset : maxY + offset) : my
            const x = horizontal ? mx : wall.x1 < minX + width / 2 ? minX - offset : maxX + offset
            const measured = wall.measurement ?? formatFeet(Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1))
            return (
              <g key={`dim-${wall.id}`}>
                <text x={x} y={y} fontSize={detailStroke * 7} textAnchor="middle" dominantBaseline="middle" fill="#000">{measured}</text>
              </g>
            )
          })}

          <g>
            <line x1={minX} y1={minY - dimOffset} x2={maxX} y2={minY - dimOffset} stroke="#000" strokeWidth={detailStroke} />
            <line x1={minX} y1={minY - dimOffset - tick} x2={minX} y2={minY - dimOffset + tick} stroke="#000" strokeWidth={detailStroke} />
            <line x1={maxX} y1={minY - dimOffset - tick} x2={maxX} y2={minY - dimOffset + tick} stroke="#000" strokeWidth={detailStroke} />
            <text x={minX + width / 2} y={minY - dimOffset - tick * 1.3} fontSize={detailStroke * 8} textAnchor="middle" fill="#000">{overallWidthLabel}</text>

            <line x1={maxX + dimOffset} y1={minY} x2={maxX + dimOffset} y2={maxY} stroke="#000" strokeWidth={detailStroke} />
            <line x1={maxX + dimOffset - tick} y1={minY} x2={maxX + dimOffset + tick} y2={minY} stroke="#000" strokeWidth={detailStroke} />
            <line x1={maxX + dimOffset - tick} y1={maxY} x2={maxX + dimOffset + tick} y2={maxY} stroke="#000" strokeWidth={detailStroke} />
            <text x={maxX + dimOffset + tick * 1.8} y={minY + height / 2} fontSize={detailStroke * 8} fill="#000" transform={`rotate(90 ${maxX + dimOffset + tick * 1.8} ${minY + height / 2})`} textAnchor="middle">{overallHeightLabel}</text>
          </g>

          {currentRooms.map((room) => (
            <g key={`label-${room.id}`}>
              <text x={room.x + room.width / 2} y={room.y + room.height / 2 - detailStroke * 8} textAnchor="middle" fontWeight="700" fontSize={detailStroke * 10} fill="#000">{room.name.toUpperCase()}</text>
              <text x={room.x + room.width / 2} y={room.y + room.height / 2 + detailStroke * 2} textAnchor="middle" fontSize={detailStroke * 7} fill="#000">{formatFeet(room.width)} x {formatFeet(room.height)}</text>
              <text x={room.x + room.width / 2} y={room.y + room.height / 2 + detailStroke * 10} textAnchor="middle" fontSize={detailStroke * 6} fill="#000">{room.material}</text>
            </g>
          ))}

          {currentRooms.map((room) => (
            <g key={`furniture-${room.id}`}>{drawFurniture(room, detailStroke)}</g>
          ))}

          {stairRoom && (
            <g>
              {Array.from({ length: 8 }).map((_, index) => {
                const x = stairRoom.x + (stairRoom.width / 9) * (index + 1)
                return <line key={`stair-${index}`} x1={x} y1={stairRoom.y + stairRoom.height * 0.2} x2={x} y2={stairRoom.y + stairRoom.height * 0.8} stroke="#000" strokeWidth={detailStroke} />
              })}
              <line x1={stairRoom.x + stairRoom.width * 0.2} y1={stairRoom.y + stairRoom.height * 0.85} x2={stairRoom.x + stairRoom.width * 0.8} y2={stairRoom.y + stairRoom.height * 0.85} stroke="#000" strokeWidth={detailStroke} markerEnd="url(#stair-arrow)" />
              <text x={stairRoom.x + stairRoom.width * 0.5} y={stairRoom.y + stairRoom.height * 0.95} textAnchor="middle" fontSize={detailStroke * 6} fontWeight="700">UP</text>
            </g>
          )}

          <defs>
            <marker id="stair-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill="#000" />
            </marker>
          </defs>

          <g>
            <rect x={minX} y={maxY + dimOffset * 0.8} width={width} height={titleBlockH * 0.7} fill="none" stroke="#000" strokeWidth={detailStroke} />
            <line x1={minX + width * 0.58} y1={maxY + dimOffset * 0.8} x2={minX + width * 0.58} y2={maxY + dimOffset * 0.8 + titleBlockH * 0.7} stroke="#000" strokeWidth={detailStroke} />
            <line x1={minX + width * 0.78} y1={maxY + dimOffset * 0.8} x2={minX + width * 0.78} y2={maxY + dimOffset * 0.8 + titleBlockH * 0.7} stroke="#000" strokeWidth={detailStroke} />
            <text x={minX + width * 0.02} y={maxY + dimOffset * 1.15} fontSize={detailStroke * 8} fontWeight="700">{(projectTitle || 'PROJECT').toUpperCase()} - FLOOR {selectedFloor}</text>
            <text x={minX + width * 0.02} y={maxY + dimOffset * 1.55} fontSize={detailStroke * 6}>SCALE: 1/4\" = 1'-0\"</text>
            <text x={minX + width * 0.6} y={maxY + dimOffset * 1.15} fontSize={detailStroke * 6}>DATE: {new Date().toLocaleDateString('en-US')}</text>
            <line x1={minX + width * 0.88} y1={maxY + dimOffset * 1.6} x2={minX + width * 0.88} y2={maxY + dimOffset * 0.95} stroke="#000" strokeWidth={detailStroke} />
            <polygon points={`${minX + width * 0.88},${maxY + dimOffset * 0.85} ${minX + width * 0.865},${maxY + dimOffset * 1.02} ${minX + width * 0.895},${maxY + dimOffset * 1.02}`} fill="#000" />
            <text x={minX + width * 0.88} y={maxY + dimOffset * 1.8} textAnchor="middle" fontSize={detailStroke * 5}>N</text>
          </g>
        </svg>
      </div>
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
    if (promptValue.trim() === project.prompt) return

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
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ projectId: project.id, prompt: promptValue }),
      })

      if (!response.ok) throw new Error('Floor plan generation request failed.')
      const result = (await response.json()) as FloorPlanResponse

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
        <BlueprintSvg floorPlanJson={project.floor_plan_json as FloorPlanResponse} projectTitle={project.title} />
      ) : (
        <div className="rounded-xl border-2 border-dashed border-warm-border bg-cream p-8 text-center text-warm-stone">Your generated floor plan will appear here.</div>
      )}
    </section>
  )
}
