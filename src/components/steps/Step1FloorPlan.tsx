import { useEffect, useMemo, useState } from 'react'
import { updateProject } from '../../lib/projects'
import { supabase } from '../../lib/supabase'
import { normalizeFloorPlan as unifyLayout } from '../../lib/floorPlanSchema'
import type { NormalizedRoom as LayoutChamber } from '../../lib/floorPlanSchema'
import type { Project } from '../../types/supabase'

type Step1FloorPlanProps = {
  project: Project
  onProjectChange: (project: Project) => void
}

type JsonBucket = Record<string, unknown>
type ApiEnvelope = Record<string, unknown>
type Side = 'top' | 'bottom' | 'left' | 'right'

type Segment = {
  key: string
  xA: number
  yA: number
  xB: number
  yB: number
  shell: boolean
}

type GapFeature = {
  key: string
  chamberKey?: string
  side?: Side
  offset?: number
  span?: number
  xA?: number
  yA?: number
  xB?: number
  yB?: number
}

type RenderShape = {
  minX: number
  minY: number
  width: number
  height: number
}

const toFinite = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
  }
  return null
}

const gatherSegments = (input: unknown): Segment[] => {
  if (!Array.isArray(input)) return []

  return input.reduce<Segment[]>((memo, raw, idx) => {
    if (!raw || typeof raw !== 'object') return memo
    const payload = raw as JsonBucket
    const start = (payload.start ?? payload.from) as JsonBucket | undefined
    const end = (payload.end ?? payload.to) as JsonBucket | undefined

    const xA = toFinite(payload.x1) ?? toFinite(start?.x)
    const yA = toFinite(payload.y1) ?? toFinite(start?.y)
    const xB = toFinite(payload.x2) ?? toFinite(end?.x)
    const yB = toFinite(payload.y2) ?? toFinite(end?.y)

    if (xA === null || yA === null || xB === null || yB === null) return memo

    memo.push({
      key: String(payload.id ?? `segment-${idx}`),
      xA,
      yA,
      xB,
      yB,
      shell: payload.exterior === true || payload.type === 'exterior',
    })

    return memo
  }, [])
}

const gatherGaps = (input: unknown, prefix: 'entry' | 'glazing'): GapFeature[] => {
  if (!Array.isArray(input)) return []

  return input.reduce<GapFeature[]>((memo, raw, idx) => {
    if (!raw || typeof raw !== 'object') return memo
    const payload = raw as JsonBucket
    const side = payload.wall
    const safeSide: Side | undefined =
      side === 'top' || side === 'bottom' || side === 'left' || side === 'right' ? side : undefined

    memo.push({
      key: String(payload.id ?? `${prefix}-${idx}`),
      chamberKey: payload.roomId ? String(payload.roomId) : payload.room_id ? String(payload.room_id) : undefined,
      side: safeSide,
      offset: toFinite(payload.position) ?? undefined,
      span: toFinite(payload.width) ?? undefined,
      xA: toFinite(payload.x1) ?? undefined,
      yA: toFinite(payload.y1) ?? undefined,
      xB: toFinite(payload.x2) ?? undefined,
      yB: toFinite(payload.y2) ?? undefined,
    })

    return memo
  }, [])
}

const measureEnvelope = (spaces: LayoutChamber[], edges: Segment[]): RenderShape => {
  const xValues: number[] = []
  const yValues: number[] = []

  edges.forEach((edge) => {
    xValues.push(edge.xA, edge.xB)
    yValues.push(edge.yA, edge.yB)
  })

  spaces.forEach((space) => {
    xValues.push(space.x, space.x + space.width)
    yValues.push(space.y, space.y + space.height)
  })

  if (!xValues.length || !yValues.length) {
    return { minX: 0, minY: 0, width: 100, height: 100 }
  }

  const minX = Math.min(...xValues)
  const minY = Math.min(...yValues)
  const maxX = Math.max(...xValues)
  const maxY = Math.max(...yValues)

  return {
    minX,
    minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  }
}

const inferShellEdges = (edges: Segment[], spaces: LayoutChamber[]): Segment[] => {
  if (!spaces.length) return edges
  const envelope = measureEnvelope(spaces, [])
  const slack = Math.max(envelope.width, envelope.height) * 0.015

  return edges.map((edge) => {
    if (edge.shell) return edge

    const onBorder =
      (Math.abs(edge.xA - envelope.minX) < slack && Math.abs(edge.xB - envelope.minX) < slack) ||
      (Math.abs(edge.xA - (envelope.minX + envelope.width)) < slack &&
        Math.abs(edge.xB - (envelope.minX + envelope.width)) < slack) ||
      (Math.abs(edge.yA - envelope.minY) < slack && Math.abs(edge.yB - envelope.minY) < slack) ||
      (Math.abs(edge.yA - (envelope.minY + envelope.height)) < slack &&
        Math.abs(edge.yB - (envelope.minY + envelope.height)) < slack)

    return { ...edge, shell: onBorder }
  })
}

const locateGapSegment = (gap: GapFeature, chamberIndex: Map<string, LayoutChamber>) => {
  if (
    gap.xA !== undefined &&
    gap.yA !== undefined &&
    gap.xB !== undefined &&
    gap.yB !== undefined
  ) {
    return { xA: gap.xA, yA: gap.yA, xB: gap.xB, yB: gap.yB }
  }

  if (!gap.chamberKey || !gap.side || gap.offset === undefined || gap.span === undefined) {
    return null
  }

  const chamber = chamberIndex.get(gap.chamberKey)
  if (!chamber) return null

  const lead = gap.offset
  const tail = gap.offset + gap.span

  if (gap.side === 'top') return { xA: chamber.x + lead, yA: chamber.y, xB: chamber.x + tail, yB: chamber.y }
  if (gap.side === 'bottom') {
    return { xA: chamber.x + lead, yA: chamber.y + chamber.height, xB: chamber.x + tail, yB: chamber.y + chamber.height }
  }
  if (gap.side === 'left') return { xA: chamber.x, yA: chamber.y + lead, xB: chamber.x, yB: chamber.y + tail }
  return { xA: chamber.x + chamber.width, yA: chamber.y + lead, xB: chamber.x + chamber.width, yB: chamber.y + tail }
}

const feetLabel = (units: number) => {
  const rounded = Math.max(0, Math.round(units))
  return `${rounded}'-0\"`
}

function BlueprintCanvas({ documentData, headingText }: { documentData: ApiEnvelope; headingText: string }) {
  const [storyPointer, setStoryPointer] = useState(0)

  const parsedDocument = useMemo(() => unifyLayout(documentData), [documentData])
  const stories = parsedDocument?.floors ?? []

  useEffect(() => {
    if (storyPointer >= stories.length) setStoryPointer(0)
  }, [stories.length, storyPointer])

  const selectedStory = stories[storyPointer] ?? stories[0]
  const chambers = selectedStory?.rooms ?? []
  const chamberLookup = useMemo(() => new Map(chambers.map((space) => [space.id, space])), [chambers])

  const allEdges = gatherSegments(documentData.walls)
  const allEntries = gatherGaps(documentData.doors, 'entry')
  const allGlazing = gatherGaps(documentData.windows, 'glazing')

  const scopedEdgeSet = useMemo(() => {
    if (stories.length <= 1) return allEdges
    const scope = measureEnvelope(chambers, [])
    const slack = Math.max(scope.width, scope.height) * 0.05
    return allEdges.filter((edge) => {
      const xInside = (x: number) => x >= scope.minX - slack && x <= scope.minX + scope.width + slack
      const yInside = (y: number) => y >= scope.minY - slack && y <= scope.minY + scope.height + slack
      return xInside(edge.xA) && xInside(edge.xB) && yInside(edge.yA) && yInside(edge.yB)
    })
  }, [allEdges, chambers, stories.length])

  const validChamberKeys = useMemo(() => new Set(chambers.map((space) => space.id)), [chambers])
  const scopedEntries = useMemo(
    () => allEntries.filter((item) => !item.chamberKey || validChamberKeys.has(item.chamberKey)),
    [allEntries, validChamberKeys],
  )
  const scopedGlazing = useMemo(
    () => allGlazing.filter((item) => !item.chamberKey || validChamberKeys.has(item.chamberKey)),
    [allGlazing, validChamberKeys],
  )

  if (!chambers.length && !scopedEdgeSet.length) {
    return <div className="rounded-xl border border-warm-border bg-cream p-6 text-sm text-warm-stone">No geometry available.</div>
  }

  const plottedEdges = inferShellEdges(scopedEdgeSet, chambers)
  const envelope = measureEnvelope(chambers, plottedEdges)

  const paperMargin = Math.max(envelope.width, envelope.height) * 0.25
  const chartX = envelope.minX - paperMargin
  const chartY = envelope.minY - paperMargin
  const chartWidth = envelope.width + paperMargin * 2
  const chartHeight = envelope.height + paperMargin * 2

  const scaleBase = Math.max(envelope.width, envelope.height)
  const heavyStroke = scaleBase * 0.01
  const lightStroke = scaleBase * 0.004
  const noteSize = scaleBase * 0.024
  const tinyNote = noteSize * 0.72
  const swingStroke = scaleBase * 0.003
  const furnitureStroke = scaleBase * 0.0026
  const dimStroke = scaleBase * 0.0018

  const outerTop = envelope.minY - paperMargin * 0.45
  const outerRight = envelope.minX + envelope.width + paperMargin * 0.36

  const bannerW = chartWidth * 0.42
  const bannerH = chartHeight * 0.12
  const bannerX = chartX + (chartWidth - bannerW) / 2
  const bannerY = chartY + chartHeight - bannerH - paperMargin * 0.12

  const sheetDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  return (
    <div className="w-full overflow-hidden rounded-xl border border-warm-border bg-white shadow-sm">
      {stories.length > 1 && (
        <div className="flex items-center gap-2 border-b border-warm-border bg-cream px-4 py-2">
          {stories.map((story, i) => (
            <button
              key={story.floorNumber}
              type="button"
              onClick={() => setStoryPointer(i)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                storyPointer === i
                  ? 'bg-warm-black text-white'
                  : 'bg-white text-warm-black border border-warm-border hover:border-warm-black'
              }`}
            >
              {story.label}
            </button>
          ))}
        </div>
      )}

      <div className="p-3">
        <svg
          className="h-auto w-full"
          viewBox={`${chartX} ${chartY} ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Architectural blueprint"
          style={{ fontFamily: "'Arial', 'Helvetica Neue', sans-serif" }}
        >
          <rect x={chartX} y={chartY} width={chartWidth} height={chartHeight} fill="#f5f0e8" />

          {chambers.map((space) => (
            <rect
              key={`space-${space.id}`}
              x={space.x}
              y={space.y}
              width={space.width}
              height={space.height}
              fill="none"
              stroke="#000"
              strokeWidth={lightStroke * 0.6}
            />
          ))}

          {plottedEdges.map((edge) => (
            <line
              key={edge.key}
              x1={edge.xA}
              y1={edge.yA}
              x2={edge.xB}
              y2={edge.yB}
              stroke="#000"
              strokeWidth={edge.shell ? heavyStroke : lightStroke}
              strokeLinecap="square"
            />
          ))}

          {scopedGlazing.map((windowBand) => {
            const segment = locateGapSegment(windowBand, chamberLookup)
            if (!segment) return null
            return (
              <line
                key={windowBand.key}
                x1={segment.xA}
                y1={segment.yA}
                x2={segment.xB}
                y2={segment.yB}
                stroke="#000"
                strokeWidth={lightStroke * 1.4}
              />
            )
          })}

          {scopedEntries.map((swingFeature) => {
            const segment = locateGapSegment(swingFeature, chamberLookup)
            if (!segment) return null

            const dx = segment.xB - segment.xA
            const dy = segment.yB - segment.yA
            const leaf = Math.hypot(dx, dy)
            if (leaf === 0) return null

            const horizontal = Math.abs(dx) >= Math.abs(dy)
            const arcTipX = horizontal ? segment.xA : segment.xA + (dx >= 0 ? leaf : -leaf)
            const arcTipY = horizontal ? segment.yA + (dy >= 0 ? -leaf : leaf) : segment.yA
            const sweepFlag = horizontal ? (dx > 0 ? 0 : 1) : dy > 0 ? 1 : 0

            return (
              <g key={swingFeature.key}>
                <line x1={segment.xA} y1={segment.yA} x2={arcTipX} y2={arcTipY} stroke="#000" strokeWidth={swingStroke} />
                <path
                  d={`M ${arcTipX} ${arcTipY} A ${leaf} ${leaf} 0 0 ${sweepFlag} ${segment.xB} ${segment.yB}`}
                  fill="none"
                  stroke="#000"
                  strokeWidth={swingStroke}
                  strokeDasharray={`${scaleBase * 0.008} ${scaleBase * 0.005}`}
                />
              </g>
            )
          })}

          {/* Overall dimensions */}
          <line x1={envelope.minX} y1={outerTop} x2={envelope.minX + envelope.width} y2={outerTop} stroke="#000" strokeWidth={dimStroke} />
          <line x1={envelope.minX} y1={outerTop - noteSize * 0.35} x2={envelope.minX} y2={envelope.minY} stroke="#000" strokeWidth={dimStroke} />
          <line
            x1={envelope.minX + envelope.width}
            y1={outerTop - noteSize * 0.35}
            x2={envelope.minX + envelope.width}
            y2={envelope.minY}
            stroke="#000"
            strokeWidth={dimStroke}
          />
          <text
            x={envelope.minX + envelope.width / 2}
            y={outerTop - noteSize * 0.2}
            fontSize={tinyNote}
            fill="#000"
            textAnchor="middle"
            fontWeight="700"
          >
            {feetLabel(envelope.width)}
          </text>

          <line x1={outerRight} y1={envelope.minY} x2={outerRight} y2={envelope.minY + envelope.height} stroke="#000" strokeWidth={dimStroke} />
          <line x1={envelope.minX + envelope.width} y1={envelope.minY} x2={outerRight + noteSize * 0.35} y2={envelope.minY} stroke="#000" strokeWidth={dimStroke} />
          <line
            x1={envelope.minX + envelope.width}
            y1={envelope.minY + envelope.height}
            x2={outerRight + noteSize * 0.35}
            y2={envelope.minY + envelope.height}
            stroke="#000"
            strokeWidth={dimStroke}
          />
          <text
            x={outerRight + noteSize * 0.6}
            y={envelope.minY + envelope.height / 2}
            fontSize={tinyNote}
            fill="#000"
            fontWeight="700"
            transform={`rotate(90 ${outerRight + noteSize * 0.6} ${envelope.minY + envelope.height / 2})`}
            textAnchor="middle"
          >
            {feetLabel(envelope.height)}
          </text>

          {chambers.map((space) => {
            const areaText = `${Math.round(space.width * space.height)} SQ FT`
            const finishText = String((space as JsonBucket).floor_material ?? (space as JsonBucket).floorMaterial ?? 'HARDWOOD').toUpperCase()
            const centerX = space.x + space.width / 2
            const centerY = space.y + space.height / 2
            const labelFont = Math.min(noteSize, space.width * 0.12, space.height * 0.22)

            const furnitureW = space.width * 0.36
            const furnitureH = space.height * 0.2
            const furnitureX = centerX - furnitureW / 2
            const furnitureY = centerY + labelFont * 0.95

            return (
              <g key={`annot-${space.id}`}>
                <text x={centerX} y={centerY - labelFont * 0.75} fontSize={labelFont} fill="#000" fontWeight="700" textAnchor="middle">
                  {space.name.toUpperCase()}
                </text>
                <text x={centerX} y={centerY + labelFont * 0.05} fontSize={labelFont * 0.62} fill="#000" fontWeight="700" textAnchor="middle">
                  {areaText}
                </text>
                <text x={centerX} y={centerY + labelFont * 0.72} fontSize={labelFont * 0.52} fill="#000" fontWeight="700" textAnchor="middle">
                  {finishText}
                </text>

                <rect x={furnitureX} y={furnitureY} width={furnitureW} height={furnitureH} fill="none" stroke="#000" strokeWidth={furnitureStroke} />
                <line
                  x1={furnitureX}
                  y1={furnitureY + furnitureH / 2}
                  x2={furnitureX + furnitureW}
                  y2={furnitureY + furnitureH / 2}
                  stroke="#000"
                  strokeWidth={furnitureStroke * 0.7}
                />
              </g>
            )
          })}

          {/* Title block */}
          <g>
            <rect x={bannerX} y={bannerY} width={bannerW} height={bannerH} fill="#f5f0e8" stroke="#000" strokeWidth={lightStroke} />
            <line
              x1={bannerX}
              y1={bannerY + bannerH * 0.5}
              x2={bannerX + bannerW}
              y2={bannerY + bannerH * 0.5}
              stroke="#000"
              strokeWidth={dimStroke}
            />
            <text
              x={bannerX + bannerW / 2}
              y={bannerY + bannerH * 0.26}
              fontSize={noteSize * 0.75}
              fill="#000"
              fontWeight="700"
              textAnchor="middle"
            >
              {(headingText || 'FLOOR PLAN').toUpperCase()}
              {selectedStory ? ` - ${selectedStory.label.toUpperCase()}` : ''}
            </text>
            <text x={bannerX + bannerW * 0.25} y={bannerY + bannerH * 0.79} fontSize={tinyNote} fill="#000" fontWeight="700" textAnchor="middle">
              DATE: {sheetDate.toUpperCase()}
            </text>
            <text x={bannerX + bannerW * 0.74} y={bannerY + bannerH * 0.79} fontSize={tinyNote} fill="#000" fontWeight="700" textAnchor="middle">
              SCALE: 1/4\" = 1'-0\" 
            </text>
          </g>
        </svg>
      </div>
    </div>
  )
}

export function Step1FloorPlan({ project: dossier, onProjectChange: emitUpdate }: Step1FloorPlanProps) {
  const [draftPrompt, setDraftPrompt] = useState(dossier.prompt)
  const [promptSyncing, setPromptSyncing] = useState(false)
  const [working, setWorking] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const hasBlueprint = Boolean(dossier.floor_plan_json)

  async function persistPrompt() {
    if (draftPrompt.trim() === dossier.prompt) return

    setPromptSyncing(true)
    setNotice(null)

    try {
      const refreshed = await updateProject(dossier.id, { prompt: draftPrompt.trim() })
      emitUpdate(refreshed)
    } catch (fault) {
      setNotice(fault instanceof Error ? fault.message : 'Unable to save prompt.')
      setDraftPrompt(dossier.prompt)
    } finally {
      setPromptSyncing(false)
    }
  }

  async function requestBlueprint() {
    setWorking(true)
    setNotice(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) throw new Error('Not authenticated')

      const apiResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-floor-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          projectId: dossier.id,
          prompt: draftPrompt,
        }),
      })

      if (!apiResponse.ok) throw new Error('Floor plan generation request failed.')

      const body = (await apiResponse.json()) as ApiEnvelope
      const validStructured = body.building && typeof body.building === 'object' && Array.isArray((body.building as JsonBucket).floors)
      const validFlat = Array.isArray(body.rooms)

      if (!validStructured && !validFlat) {
        throw new Error('Missing floor plan payload from generator.')
      }

      const refreshed = await updateProject(dossier.id, {
        prompt: draftPrompt.trim(),
        floor_plan_json: body,
        status: 'floor_plan',
      })

      emitUpdate(refreshed)
    } catch (fault) {
      setNotice(fault instanceof Error ? fault.message : 'Unable to generate floor plan.')
    } finally {
      setWorking(false)
    }
  }

  async function advanceWorkflow() {
    const refreshed = await updateProject(dossier.id, { status: '3d_model' })
    emitUpdate(refreshed)
  }

  return (
    <section className="space-y-5 rounded-2xl border border-warm-border bg-warm-white p-6 shadow-sm">
      <div>
        <label htmlFor="project-prompt" className="mb-2 block text-sm font-medium text-warm-black">
          Initial prompt
        </label>
        <textarea
          id="project-prompt"
          value={draftPrompt}
          onChange={(event) => setDraftPrompt(event.target.value)}
          onBlur={persistPrompt}
          rows={6}
          className="w-full rounded-xl border border-warm-border bg-cream px-4 py-3 text-sm text-warm-black outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
        />
        <p className="mt-2 text-xs text-warm-stone">{promptSyncing ? 'Saving prompt…' : 'Prompt auto-saves on blur.'}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={requestBlueprint}
          disabled={working}
          className="rounded-full bg-gold px-5 py-2 text-sm font-medium text-warm-black transition hover:bg-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          Generate Floor Plan
        </button>

        <button
          type="button"
          onClick={advanceWorkflow}
          disabled={!hasBlueprint}
          className="rounded-full border border-warm-border px-5 py-2 text-sm font-medium text-warm-black transition hover:border-gold disabled:cursor-not-allowed disabled:opacity-50"
        >
          Proceed to 3D Model
        </button>
      </div>

      {working && (
        <div className="flex items-center gap-3 rounded-xl border border-warm-border bg-cream px-4 py-3 text-sm text-warm-stone">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-gold border-t-transparent" />
          Generating your floor plan&hellip;
        </div>
      )}

      {notice && <p className="text-sm text-red-700">{notice}</p>}

      {dossier.floor_plan_json ? (
        <BlueprintCanvas documentData={dossier.floor_plan_json as ApiEnvelope} headingText={dossier.title} />
      ) : (
        <div className="rounded-xl border-2 border-dashed border-warm-border bg-cream p-8 text-center text-warm-stone">
          Your generated floor plan will appear here.
        </div>
      )}
    </section>
  )
}
