type FloorPlanCanvasProps = {
  floorPlanJson: Record<string, unknown>
}

export function FloorPlanCanvas({ floorPlanJson }: FloorPlanCanvasProps) {
  return (
    <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-8 text-center text-stone">
      Floor Plan Canvas — coming next
      <pre className="mt-4 overflow-auto rounded bg-black/30 p-3 text-left text-xs text-stone">
        {JSON.stringify(floorPlanJson, null, 2)}
      </pre>
    </div>
  )
}
