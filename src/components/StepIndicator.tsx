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
    <ol className="mb-8 grid gap-3 rounded-2xl border border-warm-border bg-warm-white p-4 md:grid-cols-3">
      {steps.map((step) => {
        const isActive = step.id === activeStep
        const isCompleted = step.id < activeStep

        return (
          <li
            key={step.id}
            className={`rounded-xl border px-4 py-3 text-sm transition ${
              isActive
                ? 'border-gold bg-gold/10 text-warm-black'
                : isCompleted
                  ? 'border-emerald-400/40 bg-emerald-50 text-emerald-700'
                  : 'border-warm-border bg-cream text-warm-stone'
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
