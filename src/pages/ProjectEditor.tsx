import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { StepIndicator } from '../components/StepIndicator'
import { Step1FloorPlan } from '../components/steps/Step1FloorPlan'
import { Step2Model3D } from '../components/steps/Step2Model3D'
import { Step3Renders } from '../components/steps/Step3Renders'
import { getProject, updateProject } from '../lib/projects'
import type { Project } from '../types/supabase'

function getStepFromStatus(status: Project['status']) {
  if (status === '3d_model') {
    return 2
  }

  if (status === 'rendered') {
    return 3
  }

  return 1
}

export function ProjectEditor() {
  const { id } = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingTitle, setIsSavingTitle] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProject(projectId: string) {
      setIsLoading(true)
      setError(null)

      try {
        const loadedProject = await getProject(projectId)
        setProject(loadedProject)
        setTitleDraft(loadedProject.title)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load project.')
      } finally {
        setIsLoading(false)
      }
    }

    if (!id) {
      setError('Missing project id.')
      setIsLoading(false)
      return
    }

    void loadProject(id)
  }, [id])

  const activeStep = useMemo(() => (project ? getStepFromStatus(project.status) : 1), [project])

  async function saveTitle() {
    if (!project) {
      return
    }

    const nextTitle = titleDraft.trim() || 'Untitled Project'
    if (nextTitle === project.title) {
      setTitleDraft(nextTitle)
      return
    }

    setIsSavingTitle(true)
    setError(null)

    try {
      const updated = await updateProject(project.id, { title: nextTitle })
      setProject(updated)
      setTitleDraft(updated.title)
    } catch (titleError) {
      setError(titleError instanceof Error ? titleError.message : 'Failed to save project title.')
      setTitleDraft(project.title)
    } finally {
      setIsSavingTitle(false)
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-16">
        <p className="text-stone">Loading project editor…</p>
      </main>
    )
  }

  if (error && !project) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-16">
        <p className="text-red-300">{error}</p>
      </main>
    )
  }

  if (!project) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-16">
        <p className="text-stone">Project not found.</p>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-stone">Project Editor</p>
          <input
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={() => {
              void saveTitle()
            }}
            className="min-w-[280px] rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-2xl font-semibold text-white outline-none ring-brand/70 transition focus:ring"
          />
          <p className="mt-2 text-xs text-stone">{isSavingTitle ? 'Saving title…' : 'Title auto-saves on blur.'}</p>
        </div>
      </header>

      <StepIndicator status={project.status} />

      {activeStep === 1 && <Step1FloorPlan project={project} onProjectChange={setProject} />}
      {activeStep === 2 && <Step2Model3D project={project} onProjectChange={setProject} />}
      {activeStep === 3 && <Step3Renders project={project} onProjectChange={setProject} />}

      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
    </main>
  )
}
