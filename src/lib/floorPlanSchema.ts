/**
 * Multi-floor structured floor plan schema.
 *
 * Supports two input formats:
 *   1. Structured: `{ building: { floors: [{ rooms, ... }] } }`
 *   2. Flat (legacy): `{ rooms: [{ floor: 1 }, ...], walls?, doors?, windows? }`
 *
 * The normalizer converts either format into a unified internal representation
 * so that renderers always receive the same shape.
 */

/* ------------------------------------------------------------------ */
/*  Public types — the structured schema the LLM returns              */
/* ------------------------------------------------------------------ */

export type StructuredRoom = {
  id: string
  name: string
  type: string
  x: number
  y: number
  width: number
  height: number
  connections?: string[]
}

export type StructuredFloor = {
  floorNumber: number
  label: string
  rooms: StructuredRoom[]
  dimensions: { width: number; height: number }
}

export type StructuredBuilding = {
  name: string
  style: string
  totalFloors: number
  floors: StructuredFloor[]
}

export type StructuredFloorPlan = {
  building: StructuredBuilding
}

/* ------------------------------------------------------------------ */
/*  Internal types — what renderers consume                           */
/* ------------------------------------------------------------------ */

export type NormalizedRoom = {
  id: string
  name: string
  type: string
  x: number
  y: number
  width: number
  height: number
  floor: number
  connections?: string[]
}

export type NormalizedFloor = {
  floorNumber: number
  label: string
  rooms: NormalizedRoom[]
}

export type NormalizedFloorPlan = {
  buildingName: string
  style: string
  totalFloors: number
  floors: NormalizedFloor[]
  /** All rooms flattened, for backwards-compatible usage */
  rooms: NormalizedRoom[]
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

type UnknownRecord = Record<string, unknown>

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function parseRoom(room: unknown, index: number, floorNumber: number): NormalizedRoom | null {
  if (!room || typeof room !== 'object') return null
  const item = room as UnknownRecord

  const x = asNumber(item.x) ?? asNumber(item.left) ?? asNumber(item.x1)
  const y = asNumber(item.y) ?? asNumber(item.top) ?? asNumber(item.y1)

  const width =
    asNumber(item.width) ??
    (asNumber(item.x2) !== null && x !== null ? asNumber(item.x2)! - x : null) ??
    (asNumber(item.right) !== null && x !== null ? asNumber(item.right)! - x : null)

  const height =
    asNumber(item.height) ??
    (asNumber(item.y2) !== null && y !== null ? asNumber(item.y2)! - y : null) ??
    (asNumber(item.bottom) !== null && y !== null ? asNumber(item.bottom)! - y : null)

  if (x === null || y === null || width === null || height === null || width <= 0 || height <= 0) {
    return null
  }

  const connections = Array.isArray(item.connections)
    ? item.connections.filter((c): c is string => typeof c === 'string')
    : undefined

  return {
    id: String(item.id ?? `room-${floorNumber}-${index}`),
    name: String(item.name ?? item.label ?? `Room ${index + 1}`),
    type: String(item.type ?? 'other'),
    x,
    y,
    width,
    height,
    floor: floorNumber,
    connections,
  }
}

function floorLabel(floorNumber: number): string {
  if (floorNumber === 0) return 'Basement'
  if (floorNumber === 1) return 'Ground Floor'
  if (floorNumber === 2) return 'Second Floor'
  if (floorNumber === 3) return 'Third Floor'
  return `Floor ${floorNumber}`
}

/* ------------------------------------------------------------------ */
/*  Normalizer                                                        */
/* ------------------------------------------------------------------ */

/**
 * Accepts either the new structured format or the legacy flat format
 * and returns a unified `NormalizedFloorPlan`.
 */
export function normalizeFloorPlan(data: unknown): NormalizedFloorPlan | null {
  if (!data || typeof data !== 'object') return null

  const record = data as UnknownRecord

  // ---- Structured format: { building: { floors: [...] } } ----
  const building = record.building as UnknownRecord | undefined
  if (building && typeof building === 'object' && Array.isArray(building.floors)) {
    const floors: NormalizedFloor[] = []
    const allRooms: NormalizedRoom[] = []

    for (const rawFloor of building.floors as unknown[]) {
      if (!rawFloor || typeof rawFloor !== 'object') continue
      const floorObj = rawFloor as UnknownRecord

      const floorNum = asNumber(floorObj.floorNumber) ?? asNumber(floorObj.floor) ?? floors.length + 1
      const label = typeof floorObj.label === 'string' ? floorObj.label : floorLabel(floorNum)

      const rooms: NormalizedRoom[] = []
      if (Array.isArray(floorObj.rooms)) {
        floorObj.rooms.forEach((room: unknown, i: number) => {
          const normalized = parseRoom(room, i, floorNum)
          if (normalized) rooms.push(normalized)
        })
      }

      floors.push({ floorNumber: floorNum, label, rooms })
      allRooms.push(...rooms)
    }

    if (floors.length === 0) return null

    return {
      buildingName: typeof building.name === 'string' ? building.name : 'Untitled',
      style: typeof building.style === 'string' ? building.style : '',
      totalFloors: asNumber(building.totalFloors) ?? floors.length,
      floors: floors.sort((a, b) => a.floorNumber - b.floorNumber),
      rooms: allRooms,
    }
  }

  // ---- Flat format: { rooms: [{ floor: 1 }, ...] } ----
  if (Array.isArray(record.rooms)) {
    const allRooms: NormalizedRoom[] = []
    ;(record.rooms as unknown[]).forEach((room, i) => {
      if (!room || typeof room !== 'object') return
      const floorNum = asNumber((room as UnknownRecord).floor) ?? 1
      const normalized = parseRoom(room, i, floorNum)
      if (normalized) allRooms.push(normalized)
    })

    if (allRooms.length === 0) return null

    // Group rooms by floor
    const floorMap = new Map<number, NormalizedRoom[]>()
    for (const room of allRooms) {
      const existing = floorMap.get(room.floor) ?? []
      existing.push(room)
      floorMap.set(room.floor, existing)
    }

    const floors: NormalizedFloor[] = Array.from(floorMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([floorNum, rooms]) => ({
        floorNumber: floorNum,
        label: floorLabel(floorNum),
        rooms,
      }))

    return {
      buildingName: 'Untitled',
      style: '',
      totalFloors: floors.length,
      floors,
      rooms: allRooms,
    }
  }

  return null
}

/**
 * Type guard: does the raw JSON look like it has floor plan data?
 */
export function hasFloorPlanData(data: unknown): boolean {
  return normalizeFloorPlan(data) !== null
}
