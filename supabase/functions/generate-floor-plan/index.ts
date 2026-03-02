import { serve } from 'std/http/server'
import { createClient } from '@supabase/supabase-js'
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

type FloorPlanRoom = {
  id: string
  name: string
  type: 'bedroom' | 'bathroom' | 'kitchen' | 'living' | 'dining' | 'office' | 'garage' | 'hallway' | 'other'
  x: number
  y: number
  width: number
  height: number
}

type FloorPlanJson = {
  rooms: FloorPlanRoom[]
  walls?: Array<Record<string, unknown>>
  doors?: Array<Record<string, unknown>>
  windows?: Array<Record<string, unknown>>
}

const SYSTEM_PROMPT = `You are an architectural floor plan generator. Given a natural language description of a home or space, return ONLY valid JSON matching this exact schema — no explanation, no markdown, just raw JSON:

{
  "rooms": [
    { "id": "string", "name": "string", "type": "bedroom|bathroom|kitchen|living|dining|office|garage|hallway|other", "x": number, "y": number, "width": number, "height": number }
  ],
  "walls": [
    { "id": "string", "x1": number, "y1": number, "x2": number, "y2": number, "thickness": number }
  ],
  "doors": [
    { "id": "string", "roomId": "string", "wall": "top|bottom|left|right", "position": number, "width": number }
  ],
  "windows": [
    { "id": "string", "roomId": "string", "wall": "top|bottom|left|right", "position": number, "width": number }
  ]
}

All coordinates and dimensions are in feet. Ensure rooms are spatially adjacent and non-overlapping. Position (0,0) is top-left.`

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
  const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!openAiResponse.ok) {
    const errorText = await openAiResponse.text()
    throw new Error(`OpenAI request failed (${openAiResponse.status}): ${errorText}`)
  }

  const payload = await openAiResponse.json()
  const content = payload?.choices?.[0]?.message?.content

  if (typeof content !== 'string') {
    throw new Error('OpenAI returned an invalid completion payload.')
  }

  return parseFloorPlanJson(content)
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const openAiApiKey = Deno.env.get('OPENAI_API_KEY')

  if (!supabaseUrl || !serviceRoleKey || !openAiApiKey) {
    return jsonResponse({ error: 'Missing required environment variables.' }, 500)
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized.' }, 401)
  }

  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) {
    return jsonResponse({ error: 'Unauthorized.' }, 401)
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token)

  if (authError || !user) {
    return jsonResponse({ error: 'Unauthorized.' }, 401)
  }

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

  const { error: updateError } = await supabaseAdmin
    .from('projects')
    .update({ floor_plan_json: floorPlan, status: 'floor_plan' })
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (updateError) {
    return jsonResponse({ error: updateError.message }, 500)
  }

  return jsonResponse(floorPlan)
})
