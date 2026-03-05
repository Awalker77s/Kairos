import { useState } from 'react'
import { normalizeFloorPlan } from '../lib/floorPlanSchema'
import type { NormalizedRoom } from '../lib/floorPlanSchema'

type FloorPlanWall = {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  thickness?: number
}

type FloorPlanOpening = {
  id: string
  roomId: string
  wall: 'top' | 'bottom' | 'left' | 'right'
  position: number
  width: number
}

type FloorPlanCanvasProps = {
  floorPlanJson: Record<string, unknown> | null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

function normalizeWalls(walls: unknown): FloorPlanWall[] {
  if (!Array.isArray(walls)) {
    return []
  }

  const normalized: FloorPlanWall[] = []

  walls.forEach((wall, index) => {
    if (!wall || typeof wall !== 'object') {
      return
    }

    const item = wall as Record<string, unknown>
    const start = (item.start ?? item.from) as Record<string, unknown> | undefined
    const end = (item.end ?? item.to) as Record<string, unknown> | undefined

    const x1 = asNumber(item.x1) ?? asNumber(start?.x)
    const y1 = asNumber(item.y1) ?? asNumber(start?.y)
    const x2 = asNumber(item.x2) ?? asNumber(end?.x)
    const y2 = asNumber(item.y2) ?? asNumber(end?.y)

    if (x1 === null || y1 === null || x2 === null || y2 === null) {
      return
    }

    normalized.push({
      id: String(item.id ?? `wall-${index}`),
      x1,
      y1,
      x2,
      y2,
      thickness: asNumber(item.thickness) ?? undefined,
    })
  })

  return normalized
}

function normalizeOpenings(openings: unknown): FloorPlanOpening[] {
  if (!Array.isArray(openings)) {
    return []
  }

  return openings
    .map((opening, index) => {
      if (!opening || typeof opening !== 'object') {
        return null
      }

      const item = opening as Record<string, unknown>
      const wall = item.wall
      if (wall !== 'top' && wall !== 'bottom' && wall !== 'left' && wall !== 'right') {
        return null
      }

      const position = asNumber(item.position)
      const width = asNumber(item.width)
      if (position === null || width === null) {
        return null
      }

      return {
        id: String(item.id ?? `opening-${index}`),
        roomId: String(item.roomId ?? item.room_id ?? ''),
        wall,
        position,
        width,
      }
    })
    .filter((opening): opening is FloorPlanOpening => opening !== null)
}

const MAX_WIDTH = 800
const MAX_HEIGHT = 600
const PADDING = 24

function getBounds(rooms: NormalizedRoom[], walls: FloorPlanWall[]) {
  const wallX = walls.flatMap((wall) => [wall.x1, wall.x2])
  const wallY = walls.flatMap((wall) => [wall.y1, wall.y2])
  const roomMinX = rooms.map((room) => room.x)
  const roomMinY = rooms.map((room) => room.y)
  const roomMaxX = rooms.map((room) => room.x + room.width)
  const roomMaxY = rooms.map((room) => room.y + room.height)

  const minX = Math.min(...roomMinX, ...wallX)
  const minY = Math.min(...roomMinY, ...wallY)
  const maxX = Math.max(...roomMaxX, ...wallX)
  const maxY = Math.max(...roomMaxY, ...wallY)

  return {
    minX,
    minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  }
}

function openingPoint(room: NormalizedRoom, opening: FloorPlanOpening) {
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

export function FloorPlanCanvas({ floorPlanJson }: FloorPlanCanvasProps) {
  const [zoomLevel, setZoomLevel] = useState(1)
  const [selectedFloorIndex, setSelectedFloorIndex] = useState(0)

  if (!floorPlanJson) {
    return null
  }

  const normalized = normalizeFloorPlan(floorPlanJson)

  if (!normalized || normalized.rooms.length === 0) {
    // No structured data found — check for raw walls-only plans
    const allWalls = normalizeWalls(floorPlanJson.walls)
    if (!allWalls.length) {
      return (
        <div className="rounded-xl border border-warm-border bg-cream p-6 text-sm text-warm-stone">
          Floor plan data is missing room geometry.
        </div>
      )
    }
  }

  const floorPlan = normalized!
  const floors = floorPlan.floors
  const currentFloor = floors[selectedFloorIndex] ?? floors[0]
  const rooms = currentFloor.rooms

  const allWalls = normalizeWalls(floorPlanJson.walls)
  const allDoors = normalizeOpenings(floorPlanJson.doors)
  const allWindows = normalizeOpenings(floorPlanJson.windows)

  const roomIds = new Set(rooms.map((r) => r.id))

  const walls = (() => {
    if (floors.length <= 1) return allWalls
    const fb = getBounds(rooms, [])
    const tol = Math.max(fb.width, fb.height) * 0.05
    return allWalls.filter((w) => {
      const inX = (x: number) => x >= fb.minX - tol && x <= fb.minX + fb.width + tol
      const inY = (y: number) => y >= fb.minY - tol && y <= fb.minY + fb.height + tol
      return inX(w.x1) && inY(w.y1) && inX(w.x2) && inY(w.y2)
    })
  })()

  const doors = allDoors.filter((d) => !d.roomId || roomIds.has(d.roomId))
  const windows = allWindows.filter((w) => !w.roomId || roomIds.has(w.roomId))

  const bounds = getBounds(rooms, walls)
  const scale = Math.min((MAX_WIDTH - PADDING * 2) / bounds.width, (MAX_HEIGHT - PADDING * 2) / bounds.height)

  const viewWidth = bounds.width + PADDING * 2
  const viewHeight = bounds.height + PADDING * 2

  function zoomIn() {
    setZoomLevel((current) => Math.min(current + 0.25, 3))
  }

  function zoomOut() {
    setZoomLevel((current) => Math.max(current - 0.25, 0.5))
  }

  function resetZoom() {
    setZoomLevel(1)
  }

  return (
    <div className="w-full overflow-hidden rounded-xl border border-warm-border bg-warm-white">
      <div className="flex items-center justify-between border-b border-warm-border bg-cream px-3 py-2">
        <div className="flex items-center gap-3">
          {floors.length > 1 && (
            <div className="flex items-center gap-1">
              {floors.map((floor, index) => (
                <button
                  key={floor.floorNumber}
                  type="button"
                  onClick={() => setSelectedFloorIndex(index)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    selectedFloorIndex === index
                      ? 'bg-warm-black text-white'
                      : 'bg-white text-warm-black border border-warm-border hover:border-warm-black'
                  }`}
                >
                  {floor.label}
                </button>
              ))}
            </div>
          )}
          <p className="text-xs font-medium text-warm-stone">Zoom: {Math.round(zoomLevel * 100)}%</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={zoomOut}
            className="rounded-md border border-warm-border bg-warm-white px-2 py-1 text-sm text-warm-black transition hover:border-gold"
          >
            −
          </button>
          <button
            type="button"
            onClick={zoomIn}
            className="rounded-md border border-warm-border bg-warm-white px-2 py-1 text-sm text-warm-black transition hover:border-gold"
          >
            +
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="rounded-md border border-warm-border bg-warm-white px-2 py-1 text-xs text-warm-black transition hover:border-gold"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="flex max-h-[70vh] min-h-[240px] w-full items-center justify-center overflow-hidden bg-cream p-3">
        <svg
          className="block max-h-[70vh] max-w-full"
          style={{
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'center center',
          }}
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Floor plan — ${currentFloor.label}`}
        >
        <defs>
          <pattern id="grid" width="4" height="4" patternUnits="userSpaceOnUse">
            <path d="M 4 0 L 0 0 0 4" fill="none" stroke="rgba(28,20,16,0.06)" strokeWidth="0.08" />
          </pattern>
        </defs>

        <g transform={`translate(${PADDING}, ${PADDING}) scale(${scale}) translate(${-bounds.minX}, ${-bounds.minY})`}>
          <rect x={bounds.minX} y={bounds.minY} width={bounds.width} height={bounds.height} fill="url(#grid)" />

          {/* Room fills */}
          {rooms.map((room) => (
            <rect
              key={`fill-${room.id}`}
              x={room.x}
              y={room.y}
              width={room.width}
              height={room.height}
              fill="#FAF7F2"
              stroke="#1A1A1A"
              strokeWidth={0.15}
            />
          ))}

          {walls.map((wall) => (
            <line
              key={wall.id}
              x1={wall.x1}
              y1={wall.y1}
              x2={wall.x2}
              y2={wall.y2}
              stroke="#1C1410"
              strokeWidth={Math.max(0.2, wall.thickness ?? 0.2)}
              strokeLinecap="round"
            />
          ))}

          {walls.length > 1 && (() => {
            const first = walls[0]
            const last = walls[walls.length - 1]
            const isClosed = first.x1 === last.x2 && first.y1 === last.y2

            if (isClosed) {
              return null
            }

            return (
              <line
                x1={last.x2}
                y1={last.y2}
                x2={first.x1}
                y2={first.y1}
                stroke="#1C1410"
                strokeWidth={Math.max(0.2, last.thickness ?? 0.2)}
                strokeDasharray="0.5 0.3"
              />
            )
          })()}

          {doors.map((door) => {
            const room = rooms.find((item) => item.id === door.roomId)
            if (!room) return null

            const segment = openingPoint(room, door)
            const isHorizontal = door.wall === 'top' || door.wall === 'bottom'
            const arcSweep = door.wall === 'top' || door.wall === 'left' ? 1 : 0

            return (
              <path
                key={door.id}
                d={
                  isHorizontal
                    ? `M ${segment.x1} ${segment.y1} A ${door.width} ${door.width} 0 0 ${arcSweep} ${segment.x2} ${segment.y2}`
                    : `M ${segment.x1} ${segment.y1} A ${door.width} ${door.width} 0 0 ${arcSweep} ${segment.x2} ${segment.y2}`
                }
                fill="none"
                stroke="#1A1A1A"
                strokeWidth={0.15}
              />
            )
          })}

          {windows.map((windowItem) => {
            const room = rooms.find((item) => item.id === windowItem.roomId)
            if (!room) return null

            const segment = openingPoint(room, windowItem)
            const offset = 0.22

            if (windowItem.wall === 'top' || windowItem.wall === 'bottom') {
              const y = segment.y1
              const windowOffset = windowItem.wall === 'top' ? -offset : offset
              return (
                <g key={windowItem.id} stroke="#1A1A1A" strokeWidth={0.12}>
                  <line x1={segment.x1} y1={y - windowOffset} x2={segment.x2} y2={y - windowOffset} />
                  <line x1={segment.x1} y1={y + windowOffset} x2={segment.x2} y2={y + windowOffset} />
                </g>
              )
            }

            const x = segment.x1
            const windowOffset = windowItem.wall === 'left' ? -offset : offset
            return (
              <g key={windowItem.id} stroke="#1A1A1A" strokeWidth={0.12}>
                <line x1={x - windowOffset} y1={segment.y1} x2={x - windowOffset} y2={segment.y2} />
                <line x1={x + windowOffset} y1={segment.y1} x2={x + windowOffset} y2={segment.y2} />
              </g>
            )
          })}

          {/* Room labels — rendered last so they appear on top of doors/windows */}
          {rooms.map((room) => {
            const nameText = room.name
            const maxByWidth = (room.width * 0.85) / Math.max(nameText.length * 0.6, 1)
            const maxByHeight = room.height * 0.22
            const fitSize = Math.min(1.2, maxByWidth, maxByHeight)
            const dimSize = fitSize * 0.65
            return (
              <g key={`label-${room.id}`}>
                <text
                  x={room.x + room.width / 2}
                  y={room.y + room.height / 2 - dimSize * 0.4}
                  fill="#1C1410"
                  fontSize={fitSize}
                  fontWeight="600"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {nameText}
                </text>
                <text
                  x={room.x + room.width / 2}
                  y={room.y + room.height / 2 + fitSize * 0.9}
                  fill="#9C8E82"
                  fontSize={dimSize}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {`${room.width}' \u00d7 ${room.height}'`}
                </text>
              </g>
            )
          })}
        </g>
        </svg>
      </div>
    </div>
  )
}
