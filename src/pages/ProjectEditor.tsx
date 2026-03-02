import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Toast } from '../components/Toast'
import { StepIndicator } from '../components/StepIndicator'
import { Step1FloorPlan } from '../components/steps/Step1FloorPlan'
import { Step2Model3D } from '../components/steps/Step2Model3D'
import { Step3Renders } from '../components/steps/Step3Renders'
import { getProject, updateProject } from '../lib/projects'
import { getUserPlan } from '../lib/billing'
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
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [exportsEnabled, setExportsEnabled] = useState(true)

  useEffect(() => {
    async function loadProject(projectId: string) {
      setIsLoading(true)
      setError(null)

      try {
        const [loadedProject, plan] = await Promise.all([getProject(projectId), getUserPlan()])
        setProject(loadedProject)
        setExportsEnabled(plan.entitlements.exportsEnabled)
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
  const [displayedStep, setDisplayedStep] = useState(activeStep)
  const [isStepVisible, setIsStepVisible] = useState(true)

  useEffect(() => {
    if (activeStep === displayedStep) {
      return
    }

    setIsStepVisible(false)
    const timeoutId = window.setTimeout(() => {
      setDisplayedStep(activeStep)
      setIsStepVisible(true)
    }, 180)

    return () => window.clearTimeout(timeoutId)
  }, [activeStep, displayedStep])


  async function shareProject() {
    if (!project) {
      return
    }

    const shareUrl = `${window.location.origin}/share/${project.id}`

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
      } else {
        const input = document.createElement('input')
        input.value = shareUrl
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        input.remove()
      }

      setToastMessage('Link copied!')
    } catch {
      setError('Unable to copy share link. Please try again.')
    }
  }

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
      <main className="mx-auto w-full max-w-6xl px-6 py-16">
        <p className="text-warm-stone">Loading project editor&hellip;</p>
      </main>
    )
  }

  if (error && !project) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-16">
        <p className="text-red-700">{error}</p>
      </main>
    )
  }

  if (!project) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-16">
        <p className="text-warm-stone">Project not found.</p>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-warm-stone">Project Editor</p>
          <input
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={() => {
              void saveTitle()
            }}
            className="min-w-[280px] rounded-lg border border-warm-border bg-warm-white px-3 py-2 font-serif text-2xl font-semibold text-warm-black outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
          />
          <p className="mt-2 text-xs text-warm-stone">{isSavingTitle ? 'Saving title\u2026' : 'Title auto-saves on blur.'}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            void shareProject()
          }}
          className="rounded-full border border-warm-border px-5 py-2 text-sm font-medium text-warm-black transition hover:border-gold hover:text-gold"
        >
          Share Project
        </button>
      </header>

      <StepIndicator status={project.status} />

      <div className={`transition-opacity duration-200 ${isStepVisible ? 'opacity-100' : 'opacity-0'}`}>
        {displayedStep === 1 && <Step1FloorPlan project={project} onProjectChange={setProject} />}
        {displayedStep === 2 && <Step2Model3D project={project} onProjectChange={setProject} />}
        {displayedStep === 3 && <Step3Renders project={project} onProjectChange={setProject} exportsEnabled={exportsEnabled} />}
      </div>

      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />}
    </main>
  )
}
