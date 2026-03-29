import { fetchGames } from "@/app/actions"
import EditorGamesPageClient from "@/components/editor/EditorGamesPageClient"

export default async function EditorPage() {
  const games = await fetchGames()
  return <EditorGamesPageClient initialGames={games} />
}
