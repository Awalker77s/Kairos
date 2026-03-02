export type ProjectStatus = 'draft' | 'floor_plan' | '3d_model' | 'rendered'

export type RoomRenderStatus = 'pending' | 'generating' | 'complete' | 'error'

export type Project = {
  id: string
  user_id: string
  title: string
  prompt: string
  status: ProjectStatus
  style: string | null
  floor_plan_json: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type RoomRender = {
  id: string
  project_id: string
  room_name: string
  room_type: string
  image_url: string | null
  prompt_used: string
  status: RoomRenderStatus
  created_at: string
}
