import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type FloorPlanRoom = {
  id: string
  name: string
  type: 'bedroom' | 'bathroom' | 'kitchen' | 'living' | 'dining' | 'office' | 'garage' | 'hallway' | 'other'
  x: number
  y: number
  width: number
  height: number
  floor: number
}

type FloorPlanJson = {
  rooms: FloorPlanRoom[]
  walls?: Array<Record<string, unknown>>
  doors?: Array<Record<string, unknown>>
  windows?: Array<Record<string, unknown>>
  building?: {
    name?: string
    style?: string
    floors?: Array<{
      floorNumber?: number
      label?: string
      dimensions?: { width?: number; height?: number }
      rooms?: FloorPlanRoom[]
    }>
  }
  floor_images?: Array<{
    floor_number: number
    floor_label: string
    image_url: string
    prompt_used: string
  }>
}

type FloorImageSpec = {
  floorNumber: number
  label: string
  width: number
  height: number
  rooms: FloorPlanRoom[]
}

const SYSTEM_PROMPT = `You are a licensed residential architect with decades of experience designing homes. Given a natural language description of a home or space, you will design a professional floor plan and return ONLY valid JSON — no explanation, no markdown, just raw JSON.

DESIGN PRINCIPLES — think like a real architect:
- Rooms must use realistic standard dimensions in feet:
  - Master bedroom: ~14x16 ft, secondary bedrooms: ~12x12 ft, small bedroom: ~10x11 ft
  - Kitchen: ~10x14 ft, living room: ~16x20 ft, dining room: ~12x14 ft
  - Full bathroom: ~8x10 ft, half bath: ~5x8 ft, en-suite: ~8x12 ft
  - Garage (2-car): ~20x22 ft, hallway width: ~4 ft, foyer: ~8x8 ft
  - Laundry: ~6x8 ft, walk-in closet: ~6x8 ft, pantry: ~4x6 ft
- All coordinates are in feet. Position (0,0) is the top-left corner. Rooms must be to scale relative to each other.
- The layout must feel like a real home designed by an architect, not randomly placed boxes:
  - Entry/foyer should be near the front of the house and lead naturally into common areas.
  - Common areas (living room, kitchen, dining) should flow together in an open or semi-open plan.
  - Private areas (bedrooms, bathrooms) should be separated from common areas — typically down a hallway or on a different wing/floor.
  - The kitchen should be adjacent to the dining area and ideally have access to a back door or patio.
  - Master bedroom should feel separated from other bedrooms for privacy.
  - Bathrooms should be accessible from bedrooms or hallways, never requiring walking through another bedroom.
  - Hallways should connect rooms logically — a person should be able to mentally walk through the house and have every room make sense.
  - The garage (if present) should connect to the house through a utility area, mudroom, or hallway.
- Rooms MUST share walls and be flush against each other with no gaps. Adjacent rooms share the exact same wall coordinates.
- The overall footprint should be a cohesive, compact rectangular or L-shaped form — not scattered separate boxes.

MULTI-STORY RULES:
- Every room MUST have a "floor" field: 1 for the first floor, 2 for the second floor.
- If the home description mentions multiple stories, a second floor, or upstairs bedrooms, split rooms across floors appropriately.
- Typical layout: common areas (kitchen, living, dining, garage, foyer) on floor 1; bedrooms, bathrooms, and private spaces on floor 2.
- For single-story homes, set "floor": 1 on every room.
- Each floor should have its own independent coordinate grid starting near (0,0) — do not stack floors vertically in the same coordinate space.
- Walls, doors, and windows that belong to a room inherit that room's floor.

WALL RULES:
- Generate explicit walls for every room edge. Walls are line segments (x1,y1) to (x2,y2).
- Mark each wall as "exterior": true if it is on the outer perimeter of the house, or "exterior": false for interior walls between rooms.
- Where two rooms share a wall, output only ONE wall segment for that shared edge.
- All walls must connect cleanly at corners — no gaps or overlaps.

DOOR AND WINDOW RULES:
- Every room must have at least one door connecting it to an adjacent room or hallway.
- "position" is the offset in feet from the start of that wall edge of the room. "width" is the opening width.
- Standard interior door width: 3 ft. Front door: 3.5 ft. Sliding/patio door: 6 ft.
- Standard window width: 3–4 ft. Place windows on exterior walls only. Bedrooms and living areas should have windows.

JSON SCHEMA:
{
  "rooms": [
    { "id": "string", "name": "string", "type": "bedroom|bathroom|kitchen|living|dining|office|garage|hallway|closet|laundry|foyer|other", "x": number, "y": number, "width": number, "height": number, "floor": number }
  ],
  "walls": [
    { "id": "string", "x1": number, "y1": number, "x2": number, "y2": number, "exterior": boolean }
  ],
  "doors": [
    { "id": "string", "roomId": "string", "wall": "top|bottom|left|right", "position": number, "width": number }
  ],
  "windows": [
    { "id": "string", "roomId": "string", "wall": "top|bottom|left|right", "position": number, "width": number }
  ]
}

Return ONLY the JSON object. No commentary, no code fences.`

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function parseFloorPlanJson(raw: string): FloorPlanJson {
  const normalized = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim()
  const parsed = JSON.parse(normalized)

  if (!parsed || !Array.isArray(parsed.rooms)) {
    throw new Error('OpenAI response did not include a valid rooms array.')
  }

  return parsed as FloorPlanJson
}

async function generateFloorPlan(openAiApiKey: string, prompt: string): Promise<FloorPlanJson> {
  const promptWithSeed = `${prompt}\n\nUnique seed: ${Math.floor(Math.random() * 9000) + 1000}`

  const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      temperature: 1.0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: promptWithSeed },
      ],
    }),
  })

  if (!openAiResponse.ok) {
    const errorText = await openAiResponse.text()
    throw new Error(`OpenAI request failed (${openAiResponse.status}): ${errorText}`)
  }

  const payload = await openAiResponse.json()
  console.log('generate-floor-plan OpenAI raw payload:', JSON.stringify(payload))
  const content = payload?.choices?.[0]?.message?.content

  if (typeof content !== 'string') {
    throw new Error('OpenAI returned an invalid completion payload.')
  }

  return parseFloorPlanJson(content)
}

function collectFloors(floorPlan: FloorPlanJson): FloorImageSpec[] {
  const structuredFloors = floorPlan.building?.floors
  if (Array.isArray(structuredFloors) && structuredFloors.length > 0) {
    return structuredFloors
      .map((floor, index) => {
        const floorNumber = typeof floor.floorNumber === 'number' ? floor.floorNumber : index + 1
        const label = typeof floor.label === 'string' ? floor.label : `Floor ${floorNumber}`
        const rooms = Array.isArray(floor.rooms) ? floor.rooms : []
        const width =
          typeof floor.dimensions?.width === 'number'
            ? floor.dimensions.width
            : Math.max(...rooms.map((room) => room.x + room.width), 0)
        const height =
          typeof floor.dimensions?.height === 'number'
            ? floor.dimensions.height
            : Math.max(...rooms.map((room) => room.y + room.height), 0)

        return {
          floorNumber,
          label,
          width: Math.max(1, width),
          height: Math.max(1, height),
          rooms,
        }
      })
      .sort((a, b) => a.floorNumber - b.floorNumber)
  }

  const floorMap = new Map<number, FloorPlanRoom[]>()
  for (const room of floorPlan.rooms) {
    const existing = floorMap.get(room.floor) ?? []
    existing.push(room)
    floorMap.set(room.floor, existing)
  }

  return Array.from(floorMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([floorNumber, rooms]) => ({
      floorNumber,
      label: floorNumber === 1 ? 'Ground Floor' : `Floor ${floorNumber}`,
      width: Math.max(...rooms.map((room) => room.x + room.width), 1),
      height: Math.max(...rooms.map((room) => room.y + room.height), 1),
      rooms,
    }))
}

function floorRoomSummary(rooms: FloorPlanRoom[]): string {
  return rooms
    .map(
      (room) =>
        `${room.name} (${room.type}) at x:${room.x}, y:${room.y}, w:${room.width}, h:${room.height}`,
    )
    .join('; ')
}

async function generateFloorImage(openAiApiKey: string, prompt: string): Promise<string> {
  const openAiResponse = await fetch('https://api.openai.com/v1/images/generations', {
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

  if (!openAiResponse.ok) {
    const errorText = await openAiResponse.text()
    throw new Error(`OpenAI image generation failed (${openAiResponse.status}): ${errorText}`)
  }

  const payload = await openAiResponse.json()
  const imageBase64 = payload?.data?.[0]?.b64_json

  if (typeof imageBase64 !== 'string') {
    throw new Error('OpenAI did not return image data for floor plan rendering.')
  }

  return imageBase64
}

async function generateFloorImages(
  floorPlan: FloorPlanJson,
  projectId: string,
  userId: string,
  buildingStyle: string,
  openAiApiKey: string,
  adminClient: ReturnType<typeof createClient>,
) {
  const floors = collectFloors(floorPlan)
  if (floors.length === 0) return []

  const floorImages: FloorPlanJson['floor_images'] = []

  for (let index = 0; index < floors.length; index += 1) {
    const floor = floors[index]
    const previousFloor = index > 0 ? floors[index - 1] : null

    const prompt = `Architectural top-down floor plan for ${floor.label} of a ${buildingStyle || 'residential'} building. Rooms: ${floorRoomSummary(
      floor.rooms,
    )}.\nThe building footprint is ${floor.width}x${floor.height} meters. Structural walls and staircase must align with the floor below.\nFloor below context: ${
      previousFloor ? floorRoomSummary(previousFloor.rooms) : 'No floor below. Set baseline footprint and core structure.'
    }\nClean, technical drawing style, warm tones, consistent scale.`

    const imageBase64 = await generateFloorImage(openAiApiKey, prompt)
    const imageBytes = Uint8Array.from(atob(imageBase64), (char) => char.charCodeAt(0))
    const storagePath = `${userId}/${projectId}/floors/floor-${floor.floorNumber}.png`

    const { error: uploadError } = await adminClient.storage.from('room-renders').upload(storagePath, imageBytes, {
      contentType: 'image/png',
      upsert: true,
    })

    if (uploadError) {
      throw new Error(uploadError.message)
    }

    const { data: publicUrlData } = adminClient.storage.from('room-renders').getPublicUrl(storagePath)

    floorImages.push({
      floor_number: floor.floorNumber,
      floor_label: floor.label,
      image_url: publicUrlData.publicUrl,
      prompt_used: prompt,
    })
  }

  return floorImages
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...corsHeaders,
      },
    })
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

    let userId: string
    try {
      const parts = token.split('.')
      if (parts.length !== 3) throw new Error('Malformed JWT')

      // Fix URL-safe base64 to standard base64
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
      const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
      const payload = JSON.parse(atob(padded))

      userId = payload.sub
      if (!userId) throw new Error('No subject in token')
    } catch (e) {
      console.error('JWT decode error:', e)
      return jsonResponse({ error: 'Invalid token.' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY')!

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const body = await request.json().catch(() => null)
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
    const projectId = typeof body?.projectId === 'string' ? body.projectId.trim() : ''

    if (!prompt || !projectId) {
      return jsonResponse({ error: 'Missing required fields: prompt and projectId.' }, 400)
    }

    let floorPlan: FloorPlanJson

    try {
      floorPlan = await generateFloorPlan(openAiApiKey, prompt)
    } catch (firstError) {
      try {
        const retryPrompt = `${prompt}\n\nPrevious output was invalid. Error: ${
          firstError instanceof Error ? firstError.message : 'Unknown parse error'
        }\nReturn valid raw JSON only.`
        floorPlan = await generateFloorPlan(openAiApiKey, retryPrompt)
      } catch (retryError) {
        return jsonResponse(
          {
            error: retryError instanceof Error ? retryError.message : 'Unable to generate floor plan JSON.',
          },
          502,
        )
      }
    }

    let floorImages: FloorPlanJson['floor_images'] = []
    try {
      floorImages = await generateFloorImages(
        floorPlan,
        projectId,
        userId,
        floorPlan.building?.style ?? '',
        openAiApiKey,
        adminClient,
      )
    } catch (imageError) {
      console.error('Floor image generation failed:', imageError)
    }

    const floorPlanWithImages: FloorPlanJson = {
      ...floorPlan,
      floor_images: floorImages,
    }

    const { error: updateError } = await adminClient
      .from('projects')
      .update({ floor_plan_json: floorPlanWithImages, status: 'floor_plan' })
      .eq('id', projectId)
      .eq('user_id', userId)

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500)
    }

    return jsonResponse(floorPlanWithImages)
  } catch (e) {
    console.error('Unhandled error:', e)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
