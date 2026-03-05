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

function createSystemPrompt(seed: number): string {
  return `You are an architectural floor plan generator. Return ONLY valid JSON, no markdown.

STRICT LAYOUT RULES:
- All rooms must tile together with ZERO gaps. Adjacent rooms must share an exact wall edge.
- The building is a single solid rectangle. Every room must fit within it perfectly.
- Start from x:0, y:0. The first room starts at the top-left corner.
- Rooms on the same row must have the same y value and their heights must match.
- Rooms in the same column must have the same x value and their widths must match.
- A room's x + width must equal the next room's x on the same row.
- A room's y + height must equal the next room's y in the same column.
- Double-check: sum of all room widths in any row must equal building width exactly.
- Double-check: sum of all room heights in any column must equal building height exactly.
- Typical building: 14 wide x 10 deep. Vary this per generation.
- Unique seed: ${seed}

Return schema:
{
  building: {
    name, style, totalFloors,
    floors: [{
      floorNumber, label,
      dimensions: { width: number, height: number },
      rooms: [{ id, name, type, x, y, width, height, connections }]
    }]
  }
}`
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

function parseFloorPlanJson(raw: string): FloorPlanJson {
  const normalized = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim()
  const parsed = JSON.parse(normalized)

  const parsedRecord = parsed as Record<string, unknown>

  if (parsedRecord?.building && !parsedRecord.rooms && Array.isArray((parsedRecord.building as Record<string, unknown>).floors)) {
    const floors = (parsedRecord.building as { floors: Array<{ floorNumber?: number; rooms?: FloorPlanRoom[] }> }).floors
    const flattenedRooms = floors.flatMap((floor, floorIndex) => {
      const floorNumber = typeof floor.floorNumber === 'number' ? floor.floorNumber : floorIndex + 1
      const rooms = Array.isArray(floor.rooms) ? floor.rooms : []
      return rooms.map((room) => ({
        ...room,
        floor: typeof room.floor === 'number' ? room.floor : floorNumber,
      }))
    })
    parsedRecord.rooms = flattenedRooms
  }

  if (!parsed || !Array.isArray(parsedRecord.rooms)) {
    throw new Error('OpenAI response did not include a valid rooms array.')
  }

  return clampRoomsToFloorDimensions(parsedRecord as FloorPlanJson)
}

function clampRoomsToFloorDimensions(floorPlan: FloorPlanJson): FloorPlanJson {
  const floors = floorPlan.building?.floors
  if (!Array.isArray(floors)) return floorPlan

  let didClamp = false

  const clampedFloors = floors.map((floor, floorIndex) => {
    const floorNumber = typeof floor.floorNumber === 'number' ? floor.floorNumber : floorIndex + 1
    const maxWidth = floor.dimensions?.width
    const maxHeight = floor.dimensions?.height
    if (typeof maxWidth !== 'number' || typeof maxHeight !== 'number' || !Array.isArray(floor.rooms)) {
      return floor
    }

    const clampedRooms = floor.rooms.map((room) => {
      const maxRoomWidth = Math.max(0, maxWidth - room.x)
      const maxRoomHeight = Math.max(0, maxHeight - room.y)
      const width = room.width > maxRoomWidth ? maxRoomWidth : room.width
      const height = room.height > maxRoomHeight ? maxRoomHeight : room.height
      if (width !== room.width || height !== room.height) {
        didClamp = true
        console.warn(
          `Clamped room "${room.id}" on floor ${floorNumber} to fit dimensions ${maxWidth}x${maxHeight}.`,
        )
      }
      return {
        ...room,
        width,
        height,
      }
    })

    return {
      ...floor,
      rooms: clampedRooms,
    }
  })

  if (!didClamp) return floorPlan

  const roomFloorMap = new Map<string, number>()
  clampedFloors.forEach((floor, floorIndex) => {
    const floorNumber = typeof floor.floorNumber === 'number' ? floor.floorNumber : floorIndex + 1
    ;(floor.rooms ?? []).forEach((room) => {
      roomFloorMap.set(room.id, floorNumber)
    })
  })

  return {
    ...floorPlan,
    building: {
      ...floorPlan.building,
      floors: clampedFloors,
    },
    rooms: floorPlan.rooms.map((room) => {
      const roomFloor = roomFloorMap.get(room.id)
      if (!roomFloor) return room
      const floor = clampedFloors.find((item, idx) => (item.floorNumber ?? idx + 1) === roomFloor)
      const floorRoom = floor?.rooms?.find((item) => item.id === room.id)
      return floorRoom ? { ...room, width: floorRoom.width, height: floorRoom.height } : room
    }),
  }
}

async function generateFloorPlan(openAiApiKey: string, prompt: string): Promise<FloorPlanJson> {
  const seed = Math.random()

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
        { role: 'system', content: createSystemPrompt(seed) },
        { role: 'user', content: prompt },
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
