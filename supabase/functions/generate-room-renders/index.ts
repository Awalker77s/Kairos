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
  width: number
  height: number
}

type FloorPlanJson = {
  rooms: FloorPlanRoom[]
}

type RoomRender = {
  id: string
  project_id: string
  room_name: string
  room_type: string
  image_url: string | null
  prompt_used: string
  status: 'pending' | 'generating' | 'complete' | 'error'
  created_at: string
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

function parseRooms(input: unknown): FloorPlanRoom[] {
  if (!input || typeof input !== 'object' || !('rooms' in input)) {
    return []
  }

  const roomsRaw = (input as Record<string, unknown>).rooms
  if (!Array.isArray(roomsRaw)) {
    return []
  }

  return roomsRaw
    .map((room) => {
      if (!room || typeof room !== 'object') {
        return null
      }

      const value = room as Record<string, unknown>
      const id = typeof value.id === 'string' ? value.id : null
      const name = typeof value.name === 'string' ? value.name : null
      const type = typeof value.type === 'string' ? value.type : null
      const width = typeof value.width === 'number' ? value.width : null
      const height = typeof value.height === 'number' ? value.height : null

      if (!id || !name || !type || width === null || height === null) {
        return null
      }

      return { id, name, type, width, height }
    })
    .filter((room): room is FloorPlanRoom => room !== null)
}

async function generateImage(openAiApiKey: string, prompt: string): Promise<string> {
  const openAiResponse = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      size: '1024x1024',
      quality: 'standard',
      n: 1,
    }),
  })

  if (!openAiResponse.ok) {
    const errorText = await openAiResponse.text()
    throw new Error(`OpenAI image generation failed (${openAiResponse.status}): ${errorText}`)
  }

  const payload = await openAiResponse.json()
  const imageUrl = payload?.data?.[0]?.url

  if (typeof imageUrl !== 'string') {
    throw new Error('OpenAI did not return an image URL.')
  }

  return imageUrl
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

  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized.' }, 401)
  }

  const token = authHeader.replace('Bearer ', '').trim()

  // Decode JWT payload to get user ID (gateway already verified the token)
  let userId: string
  try {
    const payloadBase64 = token.split('.')[1]
    const payload = JSON.parse(atob(payloadBase64))
    userId = payload.sub
    if (!userId) throw new Error('No subject in token')
  } catch {
    return jsonResponse({ error: 'Invalid token.' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const openAiApiKey = Deno.env.get('OPENAI_API_KEY')!

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const body = await request.json().catch(() => null)
  const projectId = typeof body?.projectId === 'string' ? body.projectId.trim() : ''
  const style = typeof body?.style === 'string' ? body.style.trim() : ''

  if (!projectId || !style) {
    return jsonResponse({ error: 'Missing required fields: projectId and style.' }, 400)
  }

  const { data: project, error: projectError } = await adminClient
    .from('projects')
    .select('id, user_id, floor_plan_json')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  if (projectError || !project) {
    return jsonResponse({ error: 'Project not found.' }, 404)
  }

  const rooms = parseRooms(project.floor_plan_json as FloorPlanJson)
  if (rooms.length === 0) {
    return jsonResponse({ error: 'No rooms found on this project floor plan.' }, 400)
  }

  const collectedRenders: RoomRender[] = []

  for (const room of rooms) {
    const prompt = `Photorealistic interior render of a ${style} ${room.type}, ${room.width}ft x ${room.height}ft, fully furnished and decorated, natural lighting, high detail, architectural visualization style`

    try {
      const openAiImageUrl = await generateImage(openAiApiKey, prompt)
      const imageResponse = await fetch(openAiImageUrl)

      if (!imageResponse.ok) {
        throw new Error(`Unable to download generated image (${imageResponse.status}).`)
      }

      const imageBuffer = await imageResponse.arrayBuffer()
      const storagePath = `${userId}/${projectId}/${room.id}.png`

      const { error: uploadError } = await adminClient.storage.from('room-renders').upload(storagePath, imageBuffer, {
        contentType: 'image/png',
        upsert: true,
      })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      const { data: publicUrlData } = adminClient.storage.from('room-renders').getPublicUrl(storagePath)

      const renderPayload = {
        project_id: projectId,
        room_name: room.name,
        room_type: room.type,
        image_url: publicUrlData.publicUrl,
        prompt_used: prompt,
        status: 'complete',
      }

      const { data: existingRender } = await adminClient
        .from('room_renders')
        .select('id')
        .eq('project_id', projectId)
        .eq('room_name', room.name)
        .maybeSingle()

      let renderRecord: RoomRender | null = null

      if (existingRender?.id) {
        const { data: updatedRender, error: updateError } = await adminClient
          .from('room_renders')
          .update(renderPayload)
          .eq('id', existingRender.id)
          .select('*')
          .single()

        if (updateError) {
          throw new Error(updateError.message)
        }

        renderRecord = updatedRender as RoomRender
      } else {
        const { data: insertedRender, error: insertError } = await adminClient
          .from('room_renders')
          .insert(renderPayload)
          .select('*')
          .single()

        if (insertError) {
          throw new Error(insertError.message)
        }

        renderRecord = insertedRender as RoomRender
      }

      if (renderRecord) {
        collectedRenders.push(renderRecord)
      }
    } catch (roomError) {
      const message = roomError instanceof Error ? roomError.message : 'Unexpected render generation failure.'

      await adminClient.from('room_renders').upsert(
        {
          project_id: projectId,
          room_name: room.name,
          room_type: room.type,
          image_url: null,
          prompt_used: prompt,
          status: 'error',
        },
        {
          onConflict: 'project_id,room_name',
        },
      )

      return jsonResponse({ error: `Failed generating ${room.name}: ${message}` }, 502)
    }
  }

  const { error: projectUpdateError } = await adminClient
    .from('projects')
    .update({ status: 'rendered' })
    .eq('id', projectId)
    .eq('user_id', userId)

  if (projectUpdateError) {
    return jsonResponse({ error: projectUpdateError.message }, 500)
  }

  return jsonResponse({ success: true, renders: collectedRenders })
})
