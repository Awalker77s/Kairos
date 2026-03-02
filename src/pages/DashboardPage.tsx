import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createProject, getProjects } from '../lib/projects'
import { getRendersByProject } from '../lib/renders'
import type { Project } from '../types/supabase'

const statusLabelMap: Record<Project['status'], string> = {
  draft: 'Draft',
  floor_plan: 'Floor Plan',
  '3d_model': '3D Model',
  rendered: 'Rendered',
}

const statusClasses: Record<Project['status'], string> = {
  draft: 'bg-warm-stone/15 text-warm-stone',
  floor_plan: 'bg-sky-100 text-sky-700',
  '3d_model': 'bg-indigo-100 text-indigo-700',
  rendered: 'bg-emerald-100 text-emerald-700',
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [projectThumbnails, setProjectThumbnails] = useState<Record<string, string | null>>({})
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

        const thumbnails = await Promise.all(
          results.map(async (project) => {
            const renders = await getRendersByProject(project.id)
            const firstImageUrl = renders.find((render) => render.image_url)?.image_url ?? null
            return [project.id, firstImageUrl] as const
          }),
        )

        setProjectThumbnails(Object.fromEntries(thumbnails))
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
    <main className="mx-auto w-full max-w-6xl px-6 py-14">
      <section className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-warm-black">My Projects</h1>
          <p className="mt-2 text-warm-stone">Track each project from prompt to render.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewProjectModal(true)}
          className="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-warm-black transition hover:bg-gold-dark"
        >
          New Project
        </button>
      </section>

      {error && <p className="mb-6 rounded-lg border border-red-300/40 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <DashboardSkeleton />
      ) : formattedProjects.length === 0 ? (
        <section className="rounded-2xl border-2 border-dashed border-warm-border bg-warm-white p-14 text-center">
          <h2 className="font-serif text-xl font-semibold text-warm-black">No Projects Yet</h2>
          <p className="mt-3 text-warm-stone">Create your first project to start generating floor plans, 3D models, and renders.</p>
          <button
            type="button"
            onClick={() => setShowNewProjectModal(true)}
            className="mt-6 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-warm-black transition hover:bg-gold-dark"
          >
            Create Your First Project
          </button>
        </section>
      ) : (
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {formattedProjects.map((project) => {
            const thumbnailUrl = projectThumbnails[project.id]

            return (
              <button
                key={project.id}
                type="button"
                onClick={() => navigate(`/project/${project.id}`)}
                className="overflow-hidden rounded-2xl border border-warm-border bg-warm-white text-left shadow-sm transition hover:border-gold hover:shadow-md"
              >
                {thumbnailUrl ? (
                  <img src={thumbnailUrl} alt={`${project.title || 'Project'} render thumbnail`} className="h-40 w-full object-cover" />
                ) : (
                  <div className="h-40 bg-gradient-to-br from-gold/20 via-cognac/10 to-cream-dark" />
                )}
                <div className="space-y-3 p-5">
                  <h2 className="truncate font-serif text-lg font-semibold text-warm-black">{project.title || 'Untitled Project'}</h2>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full px-2.5 py-1 font-medium ${statusClasses[project.status]}`}>
                      {statusLabelMap[project.status]}
                    </span>
                    <span className="rounded-full bg-cream-dark px-2.5 py-1 text-warm-stone">{project.style || 'No style set'}</span>
                  </div>
                  <p className="text-xs text-warm-stone">Created {project.createdDate}</p>
                </div>
              </button>
            )
          })}
        </section>
      )}

      {showNewProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-warm-black/60 px-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-warm-border bg-warm-white p-8 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-serif text-xl font-semibold text-warm-black">New Project</h2>
                <p className="mt-1 text-sm text-warm-stone">Describe the space you want to generate.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewProjectModal(false)}
                className="rounded-md border border-warm-border px-3 py-1.5 text-sm text-warm-stone transition hover:border-cognac hover:text-warm-black"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <label className="block text-sm font-medium text-warm-black">
                Project prompt
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={8}
                  placeholder="Example: Modern two-story home with open kitchen/living area, 3 bedrooms, and warm Scandinavian interior style."
                  className="mt-2 w-full rounded-lg border border-warm-border bg-cream px-4 py-3 text-warm-black outline-none transition placeholder:text-warm-stone/60 focus:border-gold focus:ring-2 focus:ring-gold/30"
                />
              </label>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-warm-black transition hover:bg-gold-dark disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {creating ? 'Creating Project\u2026' : 'Create Project'}
                </button>
              </div>

              {createError && <p className="rounded-lg border border-red-300/40 bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</p>}
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
        <div key={index} className="animate-pulse overflow-hidden rounded-2xl border border-warm-border bg-warm-white">
          <div className="h-40 bg-cream-dark" />
          <div className="space-y-3 p-5">
            <div className="h-5 w-2/3 rounded bg-cream-dark" />
            <div className="h-4 w-1/2 rounded bg-cream-dark" />
            <div className="h-4 w-1/3 rounded bg-cream-dark" />
          </div>
        </div>
      ))}
    </section>
  )
}
