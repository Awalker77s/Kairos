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
  return `You are a professional architect. Generate a complete, realistic residential floor plan. You MUST include ALL of the following room types — no exceptions: Entry/Foyer, Living Room, Kitchen, Dining Room, at least one Hallway, Bedrooms (as many as requested), and Bathrooms. Every room must have: name, x, y, width, height (in feet), floor (1 or 2), material, and a furniture array. Rooms must be adjacent and connected — no floating rooms. Layout must flow like a real home: Entry → Living Room → Kitchen/Dining → Hallway → Bedrooms/Bathrooms. If the user requests a multi-story home (2+ floors), Floor 1 must ONLY contain living areas, kitchen, dining, entry, garage, and guest bathroom. Bedrooms must be on Floor 2 only and must NEVER appear on Floor 1. Floor 2 must contain all bedrooms and non-guest bathrooms. Never return a floor plan with only bedrooms and bathrooms.`
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

  return parseArchitectJson(content)
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
