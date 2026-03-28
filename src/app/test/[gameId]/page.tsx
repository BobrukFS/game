import Link from "next/link"
import { notFound } from "next/navigation"
import { getPlayRuntimeBundle } from "@/lib/services/prisma/playRuntime"
import RuntimeSession from "@/components/runtime/RuntimeSession"

interface PageProps {
  params: Promise<{ gameId: string }>
}

export default async function TestGamePage({ params }: PageProps) {
  const { gameId } = await params
  const bundle = await getPlayRuntimeBundle(gameId)

  if (!bundle) {
    notFound()
  }

  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Test: {bundle.game.name}</h1>
        <Link href="/test" className="text-sm font-medium text-amber-700 hover:underline">
          Volver a juegos
        </Link>
      </div>

      <RuntimeSession bundle={bundle} mode="test" />
    </main>
  )
}
