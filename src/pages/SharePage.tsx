import { useParams } from 'react-router-dom'

export function SharePage() {
  const { id } = useParams()
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-20">
      <h1 className="text-3xl font-bold">Public Share View</h1>
      <p className="mt-3 text-stone">Viewing shared project: {id}</p>
    </main>
  )
}
