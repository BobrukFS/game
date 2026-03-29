import { fetchGames } from "@/app/actions"
import EditorGamesPageClient from "@/components/editor/EditorGamesPageClient"
import { Game } from "@/lib/domain"

export default async function EditorPage() {
  let games: Game[] = []

  try {
    games = await fetchGames()
  } catch (error) {
    console.error("Error loading games in editor page:", error)
  }

  return <EditorGamesPageClient initialGames={games} />
}
