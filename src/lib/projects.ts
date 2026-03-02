import { supabase } from './supabase'
import type { Project } from '../types/supabase'

const PROJECTS_TABLE = 'projects'

function buildDefaultTitle(prompt: string) {
  const trimmedPrompt = prompt.trim()
  if (!trimmedPrompt) {
    return 'Untitled Project'
  }

  return trimmedPrompt.length > 60 ? `${trimmedPrompt.slice(0, 57)}...` : trimmedPrompt
}

export async function createProject(prompt: string): Promise<Project> {
  const cleanPrompt = prompt.trim()
  if (!cleanPrompt) {
    throw new Error('Project prompt is required.')
  }

  const { data, error } = await supabase
    .from(PROJECTS_TABLE)
    .insert({
      prompt: cleanPrompt,
      title: buildDefaultTitle(cleanPrompt),
      status: 'draft',
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return data as Project
}

export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase.from(PROJECTS_TABLE).select('*').order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as Project[]
}

export async function getProject(id: string): Promise<Project> {
  const { data, error } = await supabase.from(PROJECTS_TABLE).select('*').eq('id', id).single()

  if (error) {
    throw error
  }

  return data as Project
}

export async function updateProject(id: string, changes: Partial<Project>): Promise<Project> {
  const { data, error } = await supabase.from(PROJECTS_TABLE).update(changes).eq('id', id).select().single()

  if (error) {
    throw error
  }

  return data as Project
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from(PROJECTS_TABLE).delete().eq('id', id)

  if (error) {
    throw error
  }
}
