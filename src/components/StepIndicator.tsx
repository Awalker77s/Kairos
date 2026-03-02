import type { ProjectStatus } from '../types/supabase'

type Step = {
  id: number
  label: string
}

const steps: Step[] = [
  { id: 1, label: 'Floor Plan' },
  { id: 2, label: '3D Model' },
  { id: 3, label: 'Room Renders' },
]

function getStepFromStatus(status: ProjectStatus): number {
  if (status === '3d_model') {
    return 2
  }

  if (status === 'rendered') {
    return 3
  }

  return 1
}

type StepIndicatorProps = {
  status: ProjectStatus
}

export function StepIndicator({ status }: StepIndicatorProps) {
  const activeStep = getStepFromStatus(status)

  return (
    <ol className="mb-8 grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 md:grid-cols-3">
      {steps.map((step) => {
        const isActive = step.id === activeStep
        const isCompleted = step.id < activeStep

        return (
          <li
            key={step.id}
            className={`rounded-xl border px-4 py-3 text-sm transition ${
              isActive
                ? 'border-brand bg-brand/20 text-white'
                : isCompleted
                  ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                  : 'border-white/10 bg-white/5 text-stone'
            }`}
          >
            <p className="font-medium">Step {step.id}</p>
            <p>{step.label}</p>
          </li>
        )
      })}
    </ol>
  )
}
