import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type FloorPlanRoom = {
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

type FloorPlanWall = {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  wallType: 'exterior' | 'interior'
  measurement: string
  floor: number
}

type FloorPlanOpening = {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  floor: number
}

type FloorPlanJson = {
  building: {
    name: string
    style: string
    totalFloors: number
    floors: Array<{
      floorNumber: number
      label: string
      dimensions: {
        width: number
        height: number
      }
      rooms: FloorPlanRoom[]
    }>
  }
  rooms: FloorPlanRoom[]
  walls: FloorPlanWall[]
  doors: FloorPlanOpening[]
  windows: FloorPlanOpening[]
  floor_images?: Array<{
    floor_number: number
    floor_label: string
    image_url: string
    prompt_used: string
  }>
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function makeSystemPrompt(): string {
  return `You are a professional architect. Generate a complete, realistic residential floor plan JSON.

HARD GEOMETRY REQUIREMENTS (MANDATORY):
- Rooms must tile together exactly like puzzle pieces.
- Every room edge that is intended to connect must be perfectly flush with the neighboring room edge.
- No floating rooms, no gaps, no overlaps, no misaligned corners.
- The overall footprint per floor must be either:
  1) a clean rectangle, OR
  2) a simple L-shape (a rectangle with exactly one rectangular corner notch).
- Do NOT produce stair-stepped / jagged outer boundaries.
- Use consistent axis-aligned coordinates and dimensions in feet.

PROGRAM REQUIREMENTS (MANDATORY):
- Every room must include: name, type, x, y, width, height, floor, material, furniture.
- Include realistic circulation so layout flows like a real home:
  Entry → Living Room → Kitchen/Dining → Hallway → Bedrooms/Bathrooms.
- Never return a plan containing only bedrooms and bathrooms.

SPECIAL CASE (STRICT):
- If the request is for a 2 bed / 2 bath SINGLE STORY home, you MUST include ALL of these rooms, with no exceptions:
  Entry, Living Room, Kitchen, Dining Room, Hallway, Master Bedroom, Ensuite Bathroom, Second Bedroom, Guest Bathroom, Laundry Room.

MULTI-STORY RULE:
- If user explicitly requests multi-story (2+ floors):
  Floor 1 must only contain living areas, kitchen, dining, entry, garage, and guest bathroom.
  Bedrooms must be on Floor 2 only.
  Floor 2 must contain bedrooms and non-guest bathrooms.`
}

const GRID_SCALE = 2
const GRID_EPSILON = 0.01

function toGrid(value: number): number {
  const scaled = value * GRID_SCALE
  const rounded = Math.round(scaled)
  if (Math.abs(scaled - rounded) > GRID_EPSILON) {
    throw new Error(`Room geometry must snap to ${1 / GRID_SCALE}ft increments.`)
  }
  return rounded
}

function roomsShareWall(a: FloorPlanRoom, b: FloorPlanRoom): boolean {
  const aRight = a.x + a.width
  const bRight = b.x + b.width
  const aBottom = a.y + a.height
  const bBottom = b.y + b.height

  const verticalFlush = Math.abs(aRight - b.x) < GRID_EPSILON || Math.abs(bRight - a.x) < GRID_EPSILON
  if (verticalFlush) {
    const overlap = Math.min(aBottom, bBottom) - Math.max(a.y, b.y)
    if (overlap > GRID_EPSILON) return true
  }

  const horizontalFlush = Math.abs(aBottom - b.y) < GRID_EPSILON || Math.abs(bBottom - a.y) < GRID_EPSILON
  if (horizontalFlush) {
    const overlap = Math.min(aRight, bRight) - Math.max(a.x, b.x)
    if (overlap > GRID_EPSILON) return true
  }

  return false
}

function validateTiledFootprint(rooms: FloorPlanRoom[], floorNumber: number): void {
  const occupancy = new Map<string, string>()
  let minGX = Number.POSITIVE_INFINITY
  let minGY = Number.POSITIVE_INFINITY
  let maxGX = Number.NEGATIVE_INFINITY
  let maxGY = Number.NEGATIVE_INFINITY

  for (const room of rooms) {
    const gx1 = toGrid(room.x)
    const gy1 = toGrid(room.y)
    const gx2 = toGrid(room.x + room.width)
    const gy2 = toGrid(room.y + room.height)
    if (gx2 <= gx1 || gy2 <= gy1) throw new Error(`Floor ${floorNumber} has an invalid room size.`)

    minGX = Math.min(minGX, gx1)
    minGY = Math.min(minGY, gy1)
    maxGX = Math.max(maxGX, gx2)
    maxGY = Math.max(maxGY, gy2)

    for (let x = gx1; x < gx2; x += 1) {
      for (let y = gy1; y < gy2; y += 1) {
        const key = `${x},${y}`
        if (occupancy.has(key)) {
          throw new Error(`Floor ${floorNumber} has overlapping rooms (${room.name}).`)
        }
        occupancy.set(key, room.id)
      }
    }
  }

  const holeCells: string[] = []
  for (let x = minGX; x < maxGX; x += 1) {
    for (let y = minGY; y < maxGY; y += 1) {
      const key = `${x},${y}`
      if (!occupancy.has(key)) holeCells.push(key)
    }
  }

  if (holeCells.length > 0) {
    const xs = holeCells.map((cell) => Number(cell.split(',')[0]))
    const ys = holeCells.map((cell) => Number(cell.split(',')[1]))
    const holeMinX = Math.min(...xs)
    const holeMaxX = Math.max(...xs) + 1
    const holeMinY = Math.min(...ys)
    const holeMaxY = Math.max(...ys) + 1
    const holeArea = (holeMaxX - holeMinX) * (holeMaxY - holeMinY)
    if (holeArea !== holeCells.length) {
      throw new Error(`Floor ${floorNumber} footprint must be a clean rectangle or simple L-shape.`)
    }

    const touchesLeft = holeMinX === minGX
    const touchesRight = holeMaxX === maxGX
    const touchesTop = holeMinY === minGY
    const touchesBottom = holeMaxY === maxGY
    const isCornerNotch =
      (touchesLeft && touchesTop) ||
      (touchesTop && touchesRight) ||
      (touchesRight && touchesBottom) ||
      (touchesBottom && touchesLeft)

    if (!isCornerNotch) {
      throw new Error(`Floor ${floorNumber} footprint must be a clean rectangle or simple L-shape.`)
    }
  }

  if (rooms.length > 1) {
    const connected = new Set<string>()
    connected.add(rooms[0].id)
    let expanded = true
    while (expanded) {
      expanded = false
      for (const room of rooms) {
        if (connected.has(room.id)) continue
        if (rooms.some((other) => connected.has(other.id) && roomsShareWall(room, other))) {
          connected.add(room.id)
          expanded = true
        }
      }
    }
    if (connected.size !== rooms.length) {
      throw new Error(`Floor ${floorNumber} has disconnected rooms. Rooms must share flush walls.`)
    }
  }
}

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isStrictTwoBedTwoBathSingleStoryPrompt(userPrompt: string): boolean {
  const normalized = userPrompt.toLowerCase()
  const asksTwoBed = /\b2\s*bed\b|\btwo\s*bed\b|\b2\s*bedroom\b|\btwo\s*bedroom\b/.test(normalized)
  const asksTwoBath = /\b2\s*bath\b|\btwo\s*bath\b|\b2\s*bathroom\b|\btwo\s*bathroom\b/.test(normalized)
  const asksSingleStory = /single\s*story|one\s*story|single\s*floor/.test(normalized)
  return asksTwoBed && asksTwoBath && asksSingleStory
}

function validateRequiredRoomsForSingleStory(floorPlan: FloorPlanJson): void {
  const required = [
    'entry',
    'livingroom',
    'kitchen',
    'diningroom',
    'hallway',
    'masterbedroom',
    'ensuitebathroom',
    'secondbedroom',
    'guestbathroom',
    'laundryroom',
  ]

  const labels = new Set(
    floorPlan.rooms.flatMap((room) => [normalizeLabel(room.name), normalizeLabel(room.type)]),
  )

  const missing = required.filter((token) => !labels.has(token))
  if (missing.length) {
    throw new Error(`Missing required rooms for 2 bed / 2 bath single story home: ${missing.join(', ')}`)
  }
}

function validateFloorPlan(floorPlan: FloorPlanJson, userPrompt: string): void {
  for (const floor of floorPlan.building.floors) {
    validateTiledFootprint(floor.rooms, floor.floorNumber)
  }

  const usedFloors = new Set(floorPlan.rooms.map((room) => room.floor))
  floorPlan.building.totalFloors = Math.max(1, usedFloors.size)

  if (isStrictTwoBedTwoBathSingleStoryPrompt(userPrompt)) {
    if (usedFloors.size !== 1 || !usedFloors.has(1)) {
      throw new Error('2 bed / 2 bath single-story request must place all rooms on floor 1.')
    }
    validateRequiredRoomsForSingleStory(floorPlan)
  }
}

function normalizeRoomType(type: unknown): string {
  const normalized = String(type ?? 'other').trim().toLowerCase()
  return normalized || 'other'
}

function defaultMaterialForRoomType(roomType: string): string {
  if (roomType.includes('bath')) return 'TILE'
  if (roomType.includes('bed')) return 'CARPET'
  if (roomType.includes('kitchen') || roomType.includes('entry') || roomType.includes('foyer') || roomType.includes('hall')) return 'HARDWOOD'
  if (roomType.includes('living') || roomType.includes('dining')) return 'HARDWOOD'
  return 'HARDWOOD'
}

function normalizeRoomMaterial(material: unknown, roomType: string): string {
  const normalized = typeof material === 'string' ? material.trim().toUpperCase() : ''
  return normalized || defaultMaterialForRoomType(roomType)
}

function normalizeRoomName(name: unknown): string {
  const normalized = typeof name === 'string' ? name.trim() : ''
  return normalized ? normalized.toUpperCase() : 'STORAGE'
}

function coerceNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function parseArchitectJson(rawText: string): FloorPlanJson {
  const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```/g, '').trim()
  const parsed = JSON.parse(cleaned) as Record<string, unknown>

  const building = (parsed.building ?? {}) as Record<string, unknown>
  const floorsRaw = Array.isArray(building.floors) ? building.floors : []

  const floors = floorsRaw.map((floorRaw, floorIndex) => {
    const floor = floorRaw as Record<string, unknown>
    const floorNumber = coerceNumber(floor.floorNumber, floorIndex + 1)
    const dimensions = (floor.dimensions ?? {}) as Record<string, unknown>
    const roomsRaw = Array.isArray(floor.rooms) ? floor.rooms : []

    const rooms = roomsRaw.map((roomRaw, roomIndex) => {
      const room = roomRaw as Record<string, unknown>
      const type = normalizeRoomType(room.type)
      return {
        id: String(room.id ?? `room_${floorNumber}_${roomIndex + 1}`),
        name: normalizeRoomName(room.name),
        type,
        x: coerceNumber(room.x),
        y: coerceNumber(room.y),
        width: Math.max(1, coerceNumber(room.width, 1)),
        height: Math.max(1, coerceNumber(room.height, 1)),
        floor: coerceNumber(room.floor, floorNumber),
        material: normalizeRoomMaterial(room.material, type),
        furniture: Array.isArray(room.furniture) ? room.furniture.map((item) => String(item)) : [],
      }
    })

    return {
      floorNumber,
      label: String(floor.label ?? `Floor ${floorNumber}`),
      dimensions: {
        width: Math.max(1, coerceNumber(dimensions.width, 30)),
        height: Math.max(1, coerceNumber(dimensions.height, 24)),
      },
      rooms,
    }
  })

  const flattenedRooms = floors.flatMap((floor) => floor.rooms.map((room) => ({ ...room, floor: floor.floorNumber })))

  const parseOpenings = (items: unknown): FloorPlanOpening[] => {
    if (!Array.isArray(items)) return []
    return items.map((item, index) => {
      const value = item as Record<string, unknown>
      return {
        id: String(value.id ?? `opening_${index + 1}`),
        x1: coerceNumber(value.x1),
        y1: coerceNumber(value.y1),
        x2: coerceNumber(value.x2),
        y2: coerceNumber(value.y2),
        floor: coerceNumber(value.floor, 1),
      }
    })
  }

  const wallsRaw = Array.isArray(parsed.walls) ? parsed.walls : []
  const walls: FloorPlanWall[] = wallsRaw.map((item, index) => {
    const value = item as Record<string, unknown>
    return {
      id: String(value.id ?? `wall_${index + 1}`),
      x1: coerceNumber(value.x1),
      y1: coerceNumber(value.y1),
      x2: coerceNumber(value.x2),
      y2: coerceNumber(value.y2),
      wallType: value.wallType === 'interior' ? 'interior' : 'exterior',
      measurement: String(value.measurement ?? '0\'-0"'),
      floor: coerceNumber(value.floor, 1),
    }
  })

  if (!floors.length || !flattenedRooms.length) {
    throw new Error('Model response did not include a valid building/floor/room structure.')
  }

  return {
    building: {
      name: String(building.name ?? 'Untitled Project'),
      style: String(building.style ?? 'Residential'),
      totalFloors: Math.max(1, coerceNumber(building.totalFloors, floors.length)),
      floors,
    },
    rooms: flattenedRooms,
    walls,
    doors: parseOpenings(parsed.doors),
    windows: parseOpenings(parsed.windows),
  }
}

async function generateFloorPlan(openAiApiKey: string, userPrompt: string): Promise<FloorPlanJson> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      temperature: 0.7,
      messages: [
        { role: 'system', content: makeSystemPrompt() },
        {
          role: 'user',
          content: `${userPrompt}\n\nProduce a professional architectural floor-plan JSON for drafting. Include realistic dimensions and wall measurements for every segment.`,
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI floor plan request failed (${response.status}): ${errorText}`)
  }

  const payload = await response.json()
  const content = payload?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new Error('OpenAI returned an invalid completion payload.')
  }

  const floorPlan = parseArchitectJson(content)
  validateFloorPlan(floorPlan, userPrompt)
  return floorPlan
}

async function generateFloorImage(openAiApiKey: string, prompt: string): Promise<string> {
  const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1024',
    }),
  })

  if (!imageResponse.ok) {
    const errorText = await imageResponse.text()
    throw new Error(`OpenAI image generation failed (${imageResponse.status}): ${errorText}`)
  }

  const payload = await imageResponse.json()
  const imageBase64 = payload?.data?.[0]?.b64_json
  if (typeof imageBase64 !== 'string') {
    throw new Error('Image payload did not include base64 image data.')
  }

  return imageBase64
}

async function generateFloorImages(
  floorPlan: FloorPlanJson,
  projectId: string,
  userId: string,
  openAiApiKey: string,
  adminClient: ReturnType<typeof createClient>,
) {
  const images: FloorPlanJson['floor_images'] = []

  for (const floor of floorPlan.building.floors) {
    const roomSummary = floor.rooms.map((room) => `${room.name} ${room.width}x${room.height}ft ${room.material}`).join('; ')
    const prompt = `Hand-drafted architectural blueprint floor plan on cream paper (#f5f0e8), black ink linework, title block, dimension strings, furniture outlines. ${floor.label} of ${floorPlan.building.name}. Rooms: ${roomSummary}.`

    const imageBase64 = await generateFloorImage(openAiApiKey, prompt)
    const bytes = Uint8Array.from(atob(imageBase64), (char) => char.charCodeAt(0))
    const storagePath = `${userId}/${projectId}/floors/floor-${floor.floorNumber}.png`

    const { error: uploadError } = await adminClient.storage.from('room-renders').upload(storagePath, bytes, {
      contentType: 'image/png',
      upsert: true,
    })
    if (uploadError) throw new Error(uploadError.message)

    const { data: publicUrlData } = adminClient.storage.from('room-renders').getPublicUrl(storagePath)

    images.push({
      floor_number: floor.floorNumber,
      floor_label: floor.label,
      image_url: publicUrlData.publicUrl,
      prompt_used: prompt,
    })
  }

  return images
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized.' }, 401)
    }

    const token = authHeader.replace('Bearer ', '').trim()
    const parts = token.split('.')
    if (parts.length !== 3) {
      return jsonResponse({ error: 'Invalid token.' }, 401)
    }

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const payload = JSON.parse(atob(padded)) as Record<string, unknown>
    const userId = typeof payload.sub === 'string' ? payload.sub : null
    if (!userId) {
      return jsonResponse({ error: 'Invalid token payload.' }, 401)
    }

    const body = await request.json().catch(() => null)
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
    const projectId = typeof body?.projectId === 'string' ? body.projectId.trim() : ''
    if (!prompt || !projectId) {
      return jsonResponse({ error: 'Missing required fields: prompt and projectId.' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY') ?? ''

    if (!supabaseUrl || !serviceRoleKey || !openAiApiKey) {
      return jsonResponse({ error: 'Server is missing required environment configuration.' }, 500)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    let floorPlan: FloorPlanJson
    try {
      floorPlan = await generateFloorPlan(openAiApiKey, prompt)
    } catch (error) {
      const secondAttemptPrompt = `${prompt}\n\nRetry. Previous output was invalid JSON/schema. Return strict JSON only.`
      floorPlan = await generateFloorPlan(openAiApiKey, secondAttemptPrompt)
    }

    try {
      floorPlan.floor_images = await generateFloorImages(floorPlan, projectId, userId, openAiApiKey, adminClient)
    } catch (imageError) {
      console.error('Floor image generation failed:', imageError)
      floorPlan.floor_images = []
    }

    const { error: updateError } = await adminClient
      .from('projects')
      .update({ floor_plan_json: floorPlan, status: 'floor_plan' })
      .eq('id', projectId)
      .eq('user_id', userId)

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500)
    }

    return jsonResponse(floorPlan)
  } catch (error) {
    console.error('Unhandled generate-floor-plan error:', error)
    return jsonResponse({ error: 'Internal server error.' }, 500)
  }
})
