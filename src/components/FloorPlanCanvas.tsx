import { useState } from 'react'

type FloorPlanRoom = {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
}

type FloorPlanOpening = {
  id: string
  roomId: string
  wall: 'top' | 'bottom' | 'left' | 'right'
  position: number
  width: number
}

type FloorPlanJson = {
  rooms: FloorPlanRoom[]
  doors?: FloorPlanOpening[]
  windows?: FloorPlanOpening[]
}

type FloorPlanCanvasProps = {
  floorPlanJson: FloorPlanJson | null
}

const MAX_WIDTH = 800
const MAX_HEIGHT = 600
const PADDING = 24

function getBounds(rooms: FloorPlanRoom[]) {
  const minX = Math.min(...rooms.map((room) => room.x))
  const minY = Math.min(...rooms.map((room) => room.y))
  const maxX = Math.max(...rooms.map((room) => room.x + room.width))
  const maxY = Math.max(...rooms.map((room) => room.y + room.height))

  return {
    minX,
    minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  }
}

function openingPoint(room: FloorPlanRoom, opening: FloorPlanOpening) {
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

  if (!floorPlanJson) {
    return null
  }

  const rooms = Array.isArray(floorPlanJson.rooms) ? floorPlanJson.rooms : []

  if (!rooms.length) {
    return (
      <div className="rounded-xl border border-warm-border bg-cream p-6 text-sm text-warm-stone">
        Floor plan data is missing room geometry.
      </div>
    )
  }

  const doors = Array.isArray(floorPlanJson.doors) ? floorPlanJson.doors : []
  const windows = Array.isArray(floorPlanJson.windows) ? floorPlanJson.windows : []

  const bounds = getBounds(rooms)
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
        <p className="text-xs font-medium text-warm-stone">Zoom: {Math.round(zoomLevel * 100)}%</p>
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
          aria-label="Generated 2D floor plan"
        >
        <defs>
          <pattern id="grid" width="4" height="4" patternUnits="userSpaceOnUse">
            <path d="M 4 0 L 0 0 0 4" fill="none" stroke="rgba(28,20,16,0.06)" strokeWidth="0.08" />
          </pattern>
        </defs>

        <g transform={`translate(${PADDING}, ${PADDING}) scale(${scale}) translate(${-bounds.minX}, ${-bounds.minY})`}>
          <rect x={bounds.minX} y={bounds.minY} width={bounds.width} height={bounds.height} fill="url(#grid)" />

          {rooms.map((room) => (
            <g key={room.id}>
              <rect
                x={room.x}
                y={room.y}
                width={room.width}
                height={room.height}
                fill="#FAF7F2"
                stroke="#C9A84C"
                strokeWidth={0.2}
                rx={0.2}
              />
              <text
                x={room.x + room.width / 2}
                y={room.y + room.height / 2}
                fill="#1C1410"
                fontSize={1.2}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {room.name}
              </text>
              <text
                x={room.x + room.width / 2}
                y={room.y + room.height / 2 + 1.5}
                fill="#9C8E82"
                fontSize={0.8}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {`${room.width}' \u00d7 ${room.height}'`}
              </text>
            </g>
          ))}

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
                stroke="#6B3F2A"
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
                <g key={windowItem.id} stroke="#8B5E3C" strokeWidth={0.12}>
                  <line x1={segment.x1} y1={y - windowOffset} x2={segment.x2} y2={y - windowOffset} />
                  <line x1={segment.x1} y1={y + windowOffset} x2={segment.x2} y2={y + windowOffset} />
                </g>
              )
            }

            const x = segment.x1
            const windowOffset = windowItem.wall === 'left' ? -offset : offset
            return (
              <g key={windowItem.id} stroke="#8B5E3C" strokeWidth={0.12}>
                <line x1={x - windowOffset} y1={segment.y1} x2={x - windowOffset} y2={segment.y2} />
                <line x1={x + windowOffset} y1={segment.y1} x2={x + windowOffset} y2={segment.y2} />
              </g>
            )
          })}
        </g>
        </svg>
      </div>
    </div>
  )
}
