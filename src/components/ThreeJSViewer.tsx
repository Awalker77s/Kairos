import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { normalizeFloorPlan, type NormalizedRoom } from '../lib/floorPlanSchema'

type FloorPlanWindow = {
  id: string
  roomId: string
  wall: 'top' | 'bottom' | 'left' | 'right'
  position: number
  width: number
}

type ThreeJSViewerProps = {
  floorPlanJson: Record<string, unknown> | null
}

export type ThreeJSViewerHandle = {
  toggleCeiling: () => void
  captureView: () => void
}

function CaptureRegistrar({ onCaptureReady }: { onCaptureReady: (capture: () => void) => void }) {
  const { gl } = useThree()

  useEffect(() => {
    onCaptureReady(() => {
      const dataUrl = gl.domElement.toDataURL('image/png')
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `floorplan-3d-${Date.now()}.png`
      link.click()
    })
  }, [gl, onCaptureReady])

  return null
}

function normalizeWindows(raw: unknown): FloorPlanWindow[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const w = item as Record<string, unknown>
      const wall = w.wall
      if (wall !== 'top' && wall !== 'bottom' && wall !== 'left' && wall !== 'right') return null
      const position = typeof w.position === 'number' ? w.position : null
      const width = typeof w.width === 'number' ? w.width : null
      if (position === null || width === null) return null
      return {
        id: String(w.id ?? `win-${index}`),
        roomId: String(w.roomId ?? w.room_id ?? ''),
        wall,
        position,
        width,
      }
    })
    .filter((w): w is FloorPlanWindow => w !== null)
}

export const ThreeJSViewer = forwardRef<ThreeJSViewerHandle, ThreeJSViewerProps>(function ThreeJSViewer(
  { floorPlanJson },
  ref,
) {
  const [showCeiling, setShowCeiling] = useState(true)
  const [selectedFloorIndex, setSelectedFloorIndex] = useState(0)
  const captureFnRef = useRef<() => void>(() => undefined)

  const normalized = useMemo(() => normalizeFloorPlan(floorPlanJson), [floorPlanJson])
  const allWindows = useMemo(() => normalizeWindows(floorPlanJson && (floorPlanJson as Record<string, unknown>).windows), [floorPlanJson])

  const floors = normalized?.floors ?? []
  const currentFloor = floors[selectedFloorIndex] ?? floors[0]
  const rooms: NormalizedRoom[] = currentFloor?.rooms ?? []
  const roomIds = useMemo(() => new Set(rooms.map((r) => r.id)), [rooms])
  const windows = useMemo(() => allWindows.filter((w) => !w.roomId || roomIds.has(w.roomId)), [allWindows, roomIds])

  const handleCaptureReady = useCallback((fn: () => void) => {
    captureFnRef.current = fn
  }, [])

  useImperativeHandle(ref, () => ({
    toggleCeiling: () => setShowCeiling((previous) => !previous),
    captureView: () => captureFnRef.current(),
  }))

  const bounds = useMemo(() => {
    if (rooms.length === 0) {
      return { centerX: 0, centerY: 0, span: 10 }
    }

    const minX = Math.min(...rooms.map((room) => room.x))
    const maxX = Math.max(...rooms.map((room) => room.x + room.width))
    const minY = Math.min(...rooms.map((room) => room.y))
    const maxY = Math.max(...rooms.map((room) => room.y + room.height))

    return {
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      span: Math.max(maxX - minX, maxY - minY),
    }
  }, [rooms])

  const roomById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms])

  if (!normalized || rooms.length === 0) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-xl border-2 border-dashed border-warm-border bg-cream text-warm-stone">
        Generate a floor plan first
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-warm-border bg-cream-dark">
      {floors.length > 1 && (
        <div className="flex items-center gap-2 border-b border-warm-border bg-cream px-4 py-2">
          {floors.map((floor, index) => (
            <button
              key={floor.floorNumber}
              type="button"
              onClick={() => setSelectedFloorIndex(index)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                selectedFloorIndex === index
                  ? 'bg-warm-black text-white'
                  : 'bg-white text-warm-black border border-warm-border hover:border-warm-black'
              }`}
            >
              {floor.label}
            </button>
          ))}
        </div>
      )}
      <div className="h-[520px]">
      <Canvas
        shadows
        camera={{
          position: [bounds.centerX + bounds.span, bounds.span * 0.85, -(bounds.centerY + bounds.span)],
          fov: 45,
          near: 0.1,
          far: 1000,
        }}
      >
        <color attach="background" args={['#F0EAE0']} />
        <ambientLight intensity={0.6} />
        <directionalLight castShadow intensity={0.8} position={[bounds.centerX + bounds.span * 0.7, 20, -bounds.centerY - bounds.span * 0.7]} />

        {rooms.map((room) => {
          const centerX = room.x + room.width / 2
          const centerZ = -(room.y + room.height / 2)
          const wallThickness = 0.15
          const wallHeight = 9

          return (
            <group key={room.id}>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, 0, centerZ]} receiveShadow>
                <planeGeometry args={[room.width, room.height]} />
                <meshStandardMaterial color="#d9d9d9" />
              </mesh>
              <mesh castShadow position={[centerX, wallHeight / 2, -room.y]}>
                <boxGeometry args={[room.width, wallHeight, wallThickness]} />
                <meshStandardMaterial color="#f8f8f5" />
              </mesh>
              <mesh castShadow position={[centerX, wallHeight / 2, -(room.y + room.height)]}>
                <boxGeometry args={[room.width, wallHeight, wallThickness]} />
                <meshStandardMaterial color="#f8f8f5" />
              </mesh>
              <mesh castShadow position={[room.x, wallHeight / 2, centerZ]}>
                <boxGeometry args={[wallThickness, wallHeight, room.height]} />
                <meshStandardMaterial color="#f8f8f5" />
              </mesh>
              <mesh castShadow position={[room.x + room.width, wallHeight / 2, centerZ]}>
                <boxGeometry args={[wallThickness, wallHeight, room.height]} />
                <meshStandardMaterial color="#f8f8f5" />
              </mesh>

              {showCeiling && (
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, wallHeight, centerZ]}>
                  <planeGeometry args={[room.width, room.height]} />
                  <meshStandardMaterial color="#ffffff" transparent opacity={0.2} side={THREE.DoubleSide} />
                </mesh>
              )}
            </group>
          )
        })}

        {windows.map((windowSpec) => {
          const room = roomById.get(windowSpec.roomId)
          if (!room) return null

          const windowHeight = 3
          const wallMidY = 4.5
          const inset = 0.08
          const halfWidth = windowSpec.width / 2

          let position: [number, number, number] = [room.x + room.width / 2, wallMidY, -(room.y + room.height / 2)]
          let rotationY = 0

          if (windowSpec.wall === 'top') {
            position = [room.x + windowSpec.position + halfWidth, wallMidY, -room.y + inset]
          } else if (windowSpec.wall === 'bottom') {
            position = [room.x + windowSpec.position + halfWidth, wallMidY, -(room.y + room.height) - inset]
          } else if (windowSpec.wall === 'left') {
            position = [room.x + inset, wallMidY, -(room.y + windowSpec.position + halfWidth)]
            rotationY = Math.PI / 2
          } else if (windowSpec.wall === 'right') {
            position = [room.x + room.width - inset, wallMidY, -(room.y + windowSpec.position + halfWidth)]
            rotationY = Math.PI / 2
          }

          return (
            <mesh key={windowSpec.id} position={position} rotation={[0, rotationY, 0]}>
              <planeGeometry args={[windowSpec.width, windowHeight]} />
              <meshStandardMaterial color="#7ec8ff" transparent opacity={0.45} side={THREE.DoubleSide} />
            </mesh>
          )
        })}

        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          target={[bounds.centerX, 3, -bounds.centerY]}
          minPolarAngle={0.25}
          maxPolarAngle={Math.PI / 2.1}
        />
        <CaptureRegistrar onCaptureReady={handleCaptureReady} />
      </Canvas>
      </div>
    </div>
  )
})
