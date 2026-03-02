import { useParams } from 'react-router-dom'

export function ProjectEditorPage() {
  const { id } = useParams()
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-20">
      <h1 className="text-3xl font-bold">Project Editor</h1>
      <p className="mt-3 text-stone">Editing project: {id}</p>
      <p className="mt-2 text-stone">Three-step flow: Text to 2D, 2D to 3D walkthrough, and furnished room renders.</p>
    </main>
  )
}
