import { useEffect, useState } from 'react'
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

type FloorPlanStair = {
  id: string
  x: number
  y: number
  width: number
  height: number
  direction: 'up' | 'down'
}

type FloorPlanCanvasProps = {
  floorPlanJson: Record<string, unknown> | null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function normalizeWalls(walls: unknown): FloorPlanWall[] {
  if (!Array.isArray(walls)) return []

  const normalized: FloorPlanWall[] = []
  walls.forEach((wall, index) => {
    if (!wall || typeof wall !== 'object') return
    const item = wall as Record<string, unknown>
    const start = (item.start ?? item.from) as Record<string, unknown> | undefined
    const end = (item.end ?? item.to) as Record<string, unknown> | undefined

    const x1 = asNumber(item.x1) ?? asNumber(start?.x)
    const y1 = asNumber(item.y1) ?? asNumber(start?.y)
    const x2 = asNumber(item.x2) ?? asNumber(end?.x)
    const y2 = asNumber(item.y2) ?? asNumber(end?.y)

    if (x1 === null || y1 === null || x2 === null || y2 === null) return

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
  if (!Array.isArray(openings)) return []

  return openings
    .map((opening, index) => {
      if (!opening || typeof opening !== 'object') return null
      const item = opening as Record<string, unknown>
      const wall = item.wall
      if (wall !== 'top' && wall !== 'bottom' && wall !== 'left' && wall !== 'right') return null
      const position = asNumber(item.position)
      const width = asNumber(item.width)
      if (position === null || width === null) return null

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

function normalizeStairs(stairs: unknown): FloorPlanStair[] {
  if (!Array.isArray(stairs)) return []

  return stairs
    .map((stair, index) => {
      if (!stair || typeof stair !== 'object') return null
      const item = stair as Record<string, unknown>
      const x = asNumber(item.x)
      const y = asNumber(item.y)
      const width = asNumber(item.width)
      const height = asNumber(item.height)
      if (x === null || y === null || width === null || height === null) return null
      return {
        id: String(item.id ?? `stair-${index}`),
        x,
        y,
        width,
        height,
        direction: item.direction === 'down' ? 'down' : 'up',
      }
    })
    .filter((stair): stair is FloorPlanStair => stair !== null)
}

function formatFeet(value: number) {
  const feet = Math.floor(value)
  const inches = Math.round((value - feet) * 12)
  return `${feet}'-${String(inches).padStart(2, '0')}"`
}

function roomFlooring(room: NormalizedRoom): string {
  const kind = room.type.toLowerCase()
  if (kind.includes('bath') || kind.includes('kitchen')) return 'TILE'
  if (kind.includes('bed')) return 'CARPET'
  if (kind.includes('living') || kind.includes('dining')) return 'HARD WOOD'
  return 'FLOORING N/A'
}

function roomFurniture(room: NormalizedRoom) {
  const type = room.type.toLowerCase()
  const { x, y, width: w, height: h } = room

  if (type.includes('kitchen')) {
    return (
      <g>
        <path d={`M ${x + 0.8} ${y + 0.8} H ${x + w - 0.8} V ${y + 1.6} H ${x + 1.6} V ${y + h - 0.8} H ${x + 0.8} Z`} />
        <rect x={x + 2.1} y={y + 1.05} width={1.2} height={0.45} />
        <rect x={x + w - 2.5} y={y + 1.05} width={1.3} height={0.65} />
      </g>
    )
  }

  if (type.includes('living')) {
    return (
      <g>
        <rect x={x + 1.1} y={y + h * 0.55} width={w * 0.5} height={h * 0.28} rx={0.2} />
        <rect x={x + w * 0.64} y={y + h * 0.6} width={w * 0.2} height={h * 0.14} />
      </g>
    )
  }

  if (type.includes('bed')) {
    return (
      <g>
        <rect x={x + w * 0.2} y={y + h * 0.2} width={w * 0.6} height={h * 0.55} />
        <rect x={x + w * 0.24} y={y + h * 0.22} width={w * 0.2} height={h * 0.1} />
        <rect x={x + w * 0.56} y={y + h * 0.22} width={w * 0.2} height={h * 0.1} />
      </g>
    )
  }

  if (type.includes('bath')) {
    return (
      <g>
        <rect x={x + w * 0.1} y={y + h * 0.15} width={w * 0.34} height={h * 0.22} />
        <ellipse cx={x + w * 0.66} cy={y + h * 0.48} rx={w * 0.09} ry={h * 0.12} />
        <rect x={x + w * 0.53} y={y + h * 0.57} width={w * 0.26} height={h * 0.22} rx={0.15} />
        <rect x={x + w * 0.1} y={y + h * 0.62} width={w * 0.3} height={h * 0.18} />
      </g>
    )
  }

  return null
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

  if (opening.wall === 'top') return { x1: room.x + start, y1: room.y, x2: room.x + end, y2: room.y }
  if (opening.wall === 'bottom') {
    return { x1: room.x + start, y1: room.y + room.height, x2: room.x + end, y2: room.y + room.height }
  }
  if (opening.wall === 'left') return { x1: room.x, y1: room.y + start, x2: room.x, y2: room.y + end }
  return { x1: room.x + room.width, y1: room.y + start, x2: room.x + room.width, y2: room.y + end }
}

export function FloorPlanCanvas({ floorPlanJson }: FloorPlanCanvasProps) {
  const [zoomLevel, setZoomLevel] = useState(1)
  const [selectedFloorIndex, setSelectedFloorIndex] = useState(0)

  if (!floorPlanJson) return null

  const normalized = normalizeFloorPlan(floorPlanJson)
  if (!normalized || normalized.rooms.length === 0) {
    const allWalls = normalizeWalls(floorPlanJson.walls)
    if (!allWalls.length) {
      return <div className="rounded-xl border border-warm-border bg-cream p-6 text-sm text-warm-stone">Floor plan data is missing room geometry.</div>
    }
  }

  const floors = normalized!.floors

  useEffect(() => {
    if (selectedFloorIndex >= floors.length) setSelectedFloorIndex(0)
  }, [floors.length, selectedFloorIndex])

  const currentFloor = floors[selectedFloorIndex] ?? floors[0]
  const rooms = currentFloor.rooms

  const allWalls = normalizeWalls(floorPlanJson.walls)
  const allDoors = normalizeOpenings(floorPlanJson.doors)
  const allWindows = normalizeOpenings(floorPlanJson.windows)
  const stairs = normalizeStairs(floorPlanJson.stairs)

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
          <button type="button" onClick={() => setZoomLevel((current) => Math.max(current - 0.25, 0.5))} className="rounded-md border border-warm-border bg-warm-white px-2 py-1 text-sm text-warm-black transition hover:border-gold">−</button>
          <button type="button" onClick={() => setZoomLevel((current) => Math.min(current + 0.25, 3))} className="rounded-md border border-warm-border bg-warm-white px-2 py-1 text-sm text-warm-black transition hover:border-gold">+</button>
          <button type="button" onClick={() => setZoomLevel(1)} className="rounded-md border border-warm-border bg-warm-white px-2 py-1 text-xs text-warm-black transition hover:border-gold">Reset</button>
        </div>
      </div>

      <div className="flex max-h-[70vh] min-h-[240px] w-full items-center justify-center overflow-hidden bg-[#F5F0E8] p-3">
        <svg
          className="block max-h-[70vh] max-w-full"
          style={{ width: 'auto', height: 'auto', objectFit: 'contain', transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Floor plan — ${currentFloor.label}`}
        >
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="strokeWidth">
              <path d="M 0 0 L 8 4 L 0 8 z" fill="#1a1a1a" />
            </marker>
            <pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse">
              <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#CCCCCC" strokeOpacity="0.4" strokeWidth="0.03" />
            </pattern>
          </defs>

          <g transform={`translate(${PADDING}, ${PADDING}) scale(${scale}) translate(${-bounds.minX}, ${-bounds.minY})`}>
            <rect x={bounds.minX - 4} y={bounds.minY - 4} width={bounds.width + 8} height={bounds.height + 8} fill="#F5F0E8" />
            <rect x={bounds.minX - 4} y={bounds.minY - 4} width={bounds.width + 8} height={bounds.height + 8} fill="url(#grid)" />

            {rooms.map((room) => (
              <rect key={`wall-${room.id}`} x={room.x} y={room.y} width={room.width} height={room.height} fill="none" stroke="#000" strokeWidth="5" vectorEffect="non-scaling-stroke" />
            ))}

            {walls.map((wall) => (
              <line
                key={wall.id}
                x1={wall.x1}
                y1={wall.y1}
                x2={wall.x2}
                y2={wall.y2}
                stroke="#1a1a1a"
                strokeWidth={Math.max(4, (wall.thickness ?? 0.2) * 14)}
                vectorEffect="non-scaling-stroke"
              />
            ))}

            <g stroke="#1a1a1a" strokeWidth="1.2" vectorEffect="non-scaling-stroke" fill="none">
              {rooms.map((room) => (
                <g key={`furniture-${room.id}`}>{roomFurniture(room)}</g>
              ))}
            </g>

            {doors.map((door) => {
              const room = rooms.find((item) => item.id === door.roomId)
              if (!room) return null
              const segment = openingPoint(room, door)
              const arcSweep = door.wall === 'top' || door.wall === 'left' ? 1 : 0
              return (
                <path
                  key={door.id}
                  d={`M ${segment.x1} ${segment.y1} A ${door.width} ${door.width} 0 0 ${arcSweep} ${segment.x2} ${segment.y2}`}
                  fill="none"
                  stroke="#1a1a1a"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
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
                  <g key={windowItem.id} stroke="#1a1a1a" strokeWidth="1" vectorEffect="non-scaling-stroke">
                    <line x1={segment.x1} y1={y - windowOffset} x2={segment.x2} y2={y - windowOffset} />
                    <line x1={segment.x1} y1={y + windowOffset} x2={segment.x2} y2={y + windowOffset} />
                  </g>
                )
              }
              const x = segment.x1
              const windowOffset = windowItem.wall === 'left' ? -offset : offset
              return (
                <g key={windowItem.id} stroke="#1a1a1a" strokeWidth="1" vectorEffect="non-scaling-stroke">
                  <line x1={x - windowOffset} y1={segment.y1} x2={x - windowOffset} y2={segment.y2} />
                  <line x1={x + windowOffset} y1={segment.y1} x2={x + windowOffset} y2={segment.y2} />
                </g>
              )
            })}

            {stairs.map((stair) => {
              const stepCount = 7
              const spacing = stair.height / stepCount
              return (
                <g key={stair.id} stroke="#1a1a1a" fill="none" vectorEffect="non-scaling-stroke">
                  <rect x={stair.x} y={stair.y} width={stair.width} height={stair.height} strokeWidth="1.2" />
                  {Array.from({ length: stepCount }, (_, index) => (
                    <line
                      key={`${stair.id}-step-${index}`}
                      x1={stair.x}
                      y1={stair.y + spacing * (index + 1)}
                      x2={stair.x + stair.width}
                      y2={stair.y + spacing * (index + 1)}
                      strokeWidth="0.9"
                    />
                  ))}
                  <line
                    x1={stair.x + stair.width * 0.5}
                    y1={stair.direction === 'up' ? stair.y + stair.height - 0.2 : stair.y + 0.2}
                    x2={stair.x + stair.width * 0.5}
                    y2={stair.direction === 'up' ? stair.y + 0.3 : stair.y + stair.height - 0.3}
                    strokeWidth="1.2"
                    markerEnd="url(#arrow)"
                  />
                  <text x={stair.x + stair.width + 0.3} y={stair.y + stair.height / 2} fill="#1a1a1a" fontSize="0.7" fontFamily="'Courier New', monospace">
                    {stair.direction.toUpperCase()}
                  </text>
                </g>
              )
            })}

            <g stroke="#1a1a1a" fill="none" vectorEffect="non-scaling-stroke">
              <line x1={bounds.minX} y1={bounds.minY - 2} x2={bounds.minX + bounds.width} y2={bounds.minY - 2} strokeWidth="1" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
              <line x1={bounds.minX - 2} y1={bounds.minY} x2={bounds.minX - 2} y2={bounds.minY + bounds.height} strokeWidth="1" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
              <text x={bounds.minX + bounds.width / 2} y={bounds.minY - 2.4} textAnchor="middle" fill="#1a1a1a" fontSize="0.8" fontFamily="'Courier New', monospace">
                {formatFeet(bounds.width)}
              </text>
              <text
                x={bounds.minX - 2.5}
                y={bounds.minY + bounds.height / 2}
                textAnchor="middle"
                fill="#1a1a1a"
                fontSize="0.8"
                fontFamily="'Courier New', monospace"
                transform={`rotate(-90 ${bounds.minX - 2.5} ${bounds.minY + bounds.height / 2})`}
              >
                {formatFeet(bounds.height)}
              </text>
            </g>

            {rooms.map((room) => {
              const labelSize = Math.min(0.95, Math.max(0.55, room.width * 0.08))
              return (
                <g key={`label-${room.id}`}>
                  <text
                    x={room.x + room.width / 2}
                    y={room.y + room.height / 2 - labelSize * 0.9}
                    fill="#1a1a1a"
                    fontSize={labelSize}
                    fontWeight="700"
                    fontFamily="'Courier New', monospace"
                    letterSpacing="0.04em"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {room.name.toUpperCase()}
                  </text>
                  <text
                    x={room.x + room.width / 2}
                    y={room.y + room.height / 2 + labelSize * 0.2}
                    fill="#1a1a1a"
                    fontSize={labelSize * 0.72}
                    fontFamily="'Courier New', monospace"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {`${formatFeet(room.width)} x ${formatFeet(room.height)}`}
                  </text>
                  <text
                    x={room.x + room.width / 2}
                    y={room.y + room.height / 2 + labelSize * 1.2}
                    fill="#1a1a1a"
                    fontSize={labelSize * 0.65}
                    fontFamily="'Courier New', monospace"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {roomFlooring(room)}
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
