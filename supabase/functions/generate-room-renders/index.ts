import { serve } from 'std/http/server'
import { createClient } from '@supabase/supabase-js'
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const openAiApiKey = Deno.env.get('OPENAI_API_KEY')

  if (!supabaseUrl || !serviceRoleKey || !openAiApiKey) {
    return jsonResponse({ error: 'Missing required environment variables.' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized.' }, 401)
  }

  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) {
    return jsonResponse({ error: 'Unauthorized.' }, 401)
  }

  const body = await req.json().catch(() => null)
  const projectId = typeof body?.projectId === 'string' ? body.projectId.trim() : ''
  const style = typeof body?.style === 'string' ? body.style.trim() : ''

  if (!projectId || !style) {
    return jsonResponse({ error: 'Missing required fields: projectId and style.' }, 400)
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token)

  if (authError || !user) {
    return jsonResponse({ error: 'Unauthorized.' }, 401)
  }

  const { data: project, error: projectError } = await supabaseAdmin
    .from('projects')
    .select('id, user_id, floor_plan_json')
    .eq('id', projectId)
    .eq('user_id', user.id)
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
      const storagePath = `${user.id}/${projectId}/${room.id}.png`

      const { error: uploadError } = await supabaseAdmin.storage.from('room-renders').upload(storagePath, imageBuffer, {
        contentType: 'image/png',
        upsert: true,
      })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      const { data: publicUrlData } = supabaseAdmin.storage.from('room-renders').getPublicUrl(storagePath)

      const renderPayload = {
        project_id: projectId,
        room_name: room.name,
        room_type: room.type,
        image_url: publicUrlData.publicUrl,
        prompt_used: prompt,
        status: 'complete',
      }

      const { data: existingRender } = await supabaseAdmin
        .from('room_renders')
        .select('id')
        .eq('project_id', projectId)
        .eq('room_name', room.name)
        .maybeSingle()

      let renderRecord: RoomRender | null = null

      if (existingRender?.id) {
        const { data: updatedRender, error: updateError } = await supabaseAdmin
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
        const { data: insertedRender, error: insertError } = await supabaseAdmin
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

      await supabaseAdmin.from('room_renders').upsert(
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

  const { error: projectUpdateError } = await supabaseAdmin
    .from('projects')
    .update({ status: 'rendered' })
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (projectUpdateError) {
    return jsonResponse({ error: projectUpdateError.message }, 500)
  }

  return jsonResponse({ success: true, renders: collectedRenders })
})
