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

const FLOOR_HEIGHT = 3.2
const FLOOR_SLAB_THICKNESS = 0.12
const WALL_THICKNESS = 0.12

type StairAnchor = {
  id: string
  floorNumber: number
  centerX: number
  centerZ: number
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

  useEffect(() => {
    if (selectedFloorIndex >= floors.length) {
      setSelectedFloorIndex(0)
    }
  }, [floors.length, selectedFloorIndex])

  const currentFloor = floors[selectedFloorIndex] ?? floors[0]
  const rooms: NormalizedRoom[] = currentFloor?.rooms ?? []
  const allRooms = normalized?.rooms ?? []
  const roomIds = useMemo(() => new Set(allRooms.map((r) => r.id)), [allRooms])
  const windows = useMemo(() => allWindows.filter((w) => !w.roomId || roomIds.has(w.roomId)), [allWindows, roomIds])

  const handleCaptureReady = useCallback((fn: () => void) => {
    captureFnRef.current = fn
  }, [])

  useImperativeHandle(ref, () => ({
    toggleCeiling: () => setShowCeiling((previous) => !previous),
    captureView: () => captureFnRef.current(),
  }))

  const bounds = useMemo(() => {
    if (allRooms.length === 0) {
      return { centerX: 0, centerY: 0, span: 10 }
    }

    const minX = Math.min(...allRooms.map((room) => room.x))
    const maxX = Math.max(...allRooms.map((room) => room.x + room.width))
    const minY = Math.min(...allRooms.map((room) => room.y))
    const maxY = Math.max(...allRooms.map((room) => room.y + room.height))

    return {
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      span: Math.max(maxX - minX, maxY - minY),
    }
  }, [allRooms])

  const roomById = useMemo(() => new Map(allRooms.map((room) => [room.id, room])), [allRooms])

  const stairConnections = useMemo(() => {
    const stairs: StairAnchor[] = allRooms
      .filter((room) => {
        const name = room.name.toLowerCase()
        const type = room.type.toLowerCase()
        return name.includes('stair') || type.includes('stair')
      })
      .map((room) => ({
        id: room.id,
        floorNumber: room.floor,
        centerX: room.x + room.width / 2,
        centerZ: -(room.y + room.height / 2),
      }))

    const byFloor = new Map<number, StairAnchor[]>()
    stairs.forEach((stair) => {
      byFloor.set(stair.floorNumber, [...(byFloor.get(stair.floorNumber) ?? []), stair])
    })

    const links: Array<{ id: string; x: number; z: number; y: number; height: number }> = []
    for (let i = 0; i < floors.length - 1; i += 1) {
      const fromFloor = floors[i].floorNumber
      const toFloor = floors[i + 1].floorNumber
      const fromStairs = byFloor.get(fromFloor) ?? []
      const toStairs = byFloor.get(toFloor) ?? []

      fromStairs.forEach((fromStair) => {
        const closest = toStairs
          .map((toStair) => ({
            stair: toStair,
            distance: Math.hypot(toStair.centerX - fromStair.centerX, toStair.centerZ - fromStair.centerZ),
          }))
          .sort((a, b) => a.distance - b.distance)[0]

        if (!closest || closest.distance > 1.5) return

        const lowerFloorIndex = Math.min(i, i + 1)
        links.push({
          id: `${fromStair.id}-${closest.stair.id}`,
          x: fromStair.centerX,
          z: fromStair.centerZ,
          y: lowerFloorIndex * FLOOR_HEIGHT + FLOOR_HEIGHT / 2,
          height: FLOOR_HEIGHT,
        })
      })
    }

    return links
  }, [allRooms, floors])

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

        {floors.map((floor, floorIndex) => {
          const isActiveFloor = floor.floorNumber === currentFloor.floorNumber
          const floorBaseY = floorIndex * FLOOR_HEIGHT

          return (
            <group key={`floor-${floor.floorNumber}`}>
              {floor.rooms.map((room) => {
                const centerX = room.x + room.width / 2
                const centerZ = -(room.y + room.height / 2)

                return (
                  <group key={room.id}>
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, floorBaseY + FLOOR_SLAB_THICKNESS / 2, centerZ]} receiveShadow>
                      <boxGeometry args={[room.width, FLOOR_SLAB_THICKNESS, room.height]} />
                      <meshStandardMaterial
                        color={isActiveFloor ? '#d9d9d9' : '#9aa0a8'}
                        transparent={!isActiveFloor}
                        opacity={isActiveFloor ? 1 : 0.25}
                        wireframe={!isActiveFloor}
                      />
                    </mesh>
                    <mesh castShadow position={[centerX, floorBaseY + FLOOR_HEIGHT / 2, -room.y]}>
                      <boxGeometry args={[room.width, FLOOR_HEIGHT, WALL_THICKNESS]} />
                      <meshStandardMaterial
                        color={isActiveFloor ? '#f1e2c8' : '#94a3b8'}
                        transparent={!isActiveFloor}
                        opacity={isActiveFloor ? 1 : 0.25}
                        wireframe={!isActiveFloor}
                      />
                    </mesh>
                    <mesh castShadow position={[centerX, floorBaseY + FLOOR_HEIGHT / 2, -(room.y + room.height)]}>
                      <boxGeometry args={[room.width, FLOOR_HEIGHT, WALL_THICKNESS]} />
                      <meshStandardMaterial
                        color={isActiveFloor ? '#f1e2c8' : '#94a3b8'}
                        transparent={!isActiveFloor}
                        opacity={isActiveFloor ? 1 : 0.25}
                        wireframe={!isActiveFloor}
                      />
                    </mesh>
                    <mesh castShadow position={[room.x, floorBaseY + FLOOR_HEIGHT / 2, centerZ]}>
                      <boxGeometry args={[WALL_THICKNESS, FLOOR_HEIGHT, room.height]} />
                      <meshStandardMaterial
                        color={isActiveFloor ? '#f1e2c8' : '#94a3b8'}
                        transparent={!isActiveFloor}
                        opacity={isActiveFloor ? 1 : 0.25}
                        wireframe={!isActiveFloor}
                      />
                    </mesh>
                    <mesh castShadow position={[room.x + room.width, floorBaseY + FLOOR_HEIGHT / 2, centerZ]}>
                      <boxGeometry args={[WALL_THICKNESS, FLOOR_HEIGHT, room.height]} />
                      <meshStandardMaterial
                        color={isActiveFloor ? '#f1e2c8' : '#94a3b8'}
                        transparent={!isActiveFloor}
                        opacity={isActiveFloor ? 1 : 0.25}
                        wireframe={!isActiveFloor}
                      />
                    </mesh>

                    {showCeiling && (
                      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, floorBaseY + FLOOR_HEIGHT, centerZ]}>
                        <planeGeometry args={[room.width, room.height]} />
                        <meshStandardMaterial
                          color={isActiveFloor ? '#fff3d6' : '#d0d6df'}
                          transparent
                          opacity={isActiveFloor ? 0.3 : 0.12}
                          wireframe={!isActiveFloor}
                          side={THREE.DoubleSide}
                        />
                      </mesh>
                    )}
                  </group>
                )
              })}
            </group>
          )
        })}

        {stairConnections.map((link) => (
          <mesh key={link.id} position={[link.x, link.y, link.z]}>
            <cylinderGeometry args={[0.3, 0.3, link.height, 12]} />
            <meshStandardMaterial color="#d4a648" transparent opacity={0.8} />
          </mesh>
        ))}

        {windows.map((windowSpec) => {
          const room = roomById.get(windowSpec.roomId)
          if (!room) return null

          const windowHeight = 3
          const floorIndex = floors.findIndex((floor) => floor.floorNumber === room.floor)
          const floorBaseY = Math.max(0, floorIndex) * FLOOR_HEIGHT
          const wallMidY = floorBaseY + FLOOR_HEIGHT / 2
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
          target={[bounds.centerX, Math.max(3, ((floors.length - 1) * FLOOR_HEIGHT) / 2), -bounds.centerY]}
          minPolarAngle={0.25}
          maxPolarAngle={Math.PI / 2.1}
        />
        <CaptureRegistrar onCaptureReady={handleCaptureReady} />
      </Canvas>
      </div>
    </div>
  )
})
