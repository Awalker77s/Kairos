import { supabase } from './supabase'
import type { RoomRender } from '../types/supabase'

const RENDERS_TABLE = 'room_renders'

export async function getRendersByProject(projectId: string): Promise<RoomRender[]> {
  const { data, error } = await supabase
    .from(RENDERS_TABLE)
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as RoomRender[]
}

export async function createRender(projectId: string, roomName: string, roomType: string): Promise<RoomRender> {
  const { data, error } = await supabase
    .from(RENDERS_TABLE)
    .insert({
      project_id: projectId,
      room_name: roomName,
      room_type: roomType,
      status: 'pending',
      prompt_used: '',
      image_url: null,
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return data as RoomRender
}

export async function updateRender(id: string, data: Partial<RoomRender>): Promise<RoomRender> {
  const { data: updatedRender, error } = await supabase.from(RENDERS_TABLE).update(data).eq('id', id).select().single()

  if (error) {
    throw error
  }

  return updatedRender as RoomRender
}
