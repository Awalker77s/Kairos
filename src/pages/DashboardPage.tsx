import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createProject, getProjects } from '../lib/projects'
import type { Project } from '../types/supabase'

const statusLabelMap: Record<Project['status'], string> = {
  draft: 'Draft',
  floor_plan: 'Floor Plan',
  '3d_model': '3D Model',
  rendered: 'Rendered',
}

const statusClasses: Record<Project['status'], string> = {
  draft: 'bg-white/10 text-stone',
  floor_plan: 'bg-sky-500/20 text-sky-300',
  '3d_model': 'bg-indigo-500/20 text-indigo-300',
  rendered: 'bg-emerald-500/20 text-emerald-300',
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    const loadProjects = async () => {
      setLoading(true)
      setError(null)

      try {
        const results = await getProjects()
        setProjects(results)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load projects.')
      } finally {
        setLoading(false)
      }
    }

    loadProjects()
  }, [])

  const formattedProjects = useMemo(
    () =>
      projects.map((project) => ({
        ...project,
        createdDate: new Date(project.created_at).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
      })),
    [projects],
  )

  const handleCreateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreateError(null)

    if (!prompt.trim()) {
      setCreateError('Please describe the project before creating it.')
      return
    }

    setCreating(true)
    try {
      const project = await createProject(prompt)
      setShowNewProjectModal(false)
      setPrompt('')
      navigate(`/project/${project.id}`)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Unable to create project.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12">
      <section className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Projects</h1>
          <p className="mt-2 text-stone">Track each project from prompt to render.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewProjectModal(true)}
          className="rounded-lg bg-brand-orange px-5 py-2.5 text-sm font-semibold text-brand-black transition hover:bg-amber"
        >
          New Project
        </button>
      </section>

      {error && <p className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}

      {loading ? (
        <DashboardSkeleton />
      ) : formattedProjects.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-white/15 bg-charcoal/40 p-12 text-center">
          <h2 className="text-xl font-semibold">No projects yet</h2>
          <p className="mt-3 text-stone">Create your first project to start generating floor plans, 3D models, and renders.</p>
          <button
            type="button"
            onClick={() => setShowNewProjectModal(true)}
            className="mt-6 rounded-lg bg-brand-orange px-5 py-2.5 text-sm font-semibold text-brand-black transition hover:bg-amber"
          >
            Create Your First Project
          </button>
        </section>
      ) : (
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {formattedProjects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => navigate(`/project/${project.id}`)}
              className="overflow-hidden rounded-2xl border border-white/10 bg-charcoal/70 text-left transition hover:border-brand-orange/60"
            >
              <div className="flex h-36 items-center justify-center bg-brand-black/70 text-sm text-stone">Thumbnail</div>
              <div className="space-y-3 p-4">
                <h2 className="truncate text-lg font-semibold text-off-white">{project.title || 'Untitled Project'}</h2>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-2.5 py-1 font-medium ${statusClasses[project.status]}`}>
                    {statusLabelMap[project.status]}
                  </span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-stone">{project.style || 'No style set'}</span>
                </div>
                <p className="text-xs text-stone">Created {project.createdDate}</p>
              </div>
            </button>
          ))}
        </section>
      )}

      {showNewProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/80 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-charcoal p-6 shadow-2xl shadow-black/40">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">New Project</h2>
                <p className="mt-1 text-sm text-stone">Describe the space you want to generate.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewProjectModal(false)}
                className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-stone hover:border-white/30 hover:text-off-white"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <label className="block text-sm text-stone">
                Project prompt
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={8}
                  placeholder="Example: Modern two-story home with open kitchen/living area, 3 bedrooms, and warm Scandinavian interior style."
                  className="mt-2 w-full rounded-lg border border-white/15 bg-brand-black px-4 py-3 text-off-white outline-none ring-brand-orange/50 transition focus:ring"
                />
              </label>

              {createError && <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{createError}</p>}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-brand-orange px-5 py-2.5 text-sm font-semibold text-brand-black transition hover:bg-amber disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {creating ? 'Creating Project…' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}

function DashboardSkeleton() {
  return (
    <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="animate-pulse overflow-hidden rounded-2xl border border-white/10 bg-charcoal/60">
          <div className="h-36 bg-white/5" />
          <div className="space-y-3 p-4">
            <div className="h-5 w-2/3 rounded bg-white/10" />
            <div className="h-4 w-1/2 rounded bg-white/10" />
            <div className="h-4 w-1/3 rounded bg-white/10" />
          </div>
        </div>
      ))}
    </section>
  )
}
