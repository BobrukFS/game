import { SupabaseClient } from "@supabase/supabase-js"
import { Deck } from "@/lib/domain"

export interface DeckWithGameId extends Deck {
  gameId: string
}

export async function getAllDecks(supabase: SupabaseClient): Promise<DeckWithGameId[]> {
  const { data, error } = await supabase.from("decks").select("*")

  if (error) throw error
  return (data || []).map((d: any) => ({
    id: d.id,
    gameId: d.game_id,
    name: d.name,
    type: d.type,
    description: d.description
  }))
}

export async function getDecksByGameId(
  supabase: SupabaseClient,
  gameId: string
): Promise<DeckWithGameId[]> {
  const { data, error } = await supabase
    .from("decks")
    .select("*")
    .eq("game_id", gameId)
    .order("name")

  if (error) throw error
  return (data || []).map((d: any) => ({
    id: d.id,
    gameId: d.game_id,
    name: d.name,
    type: d.type,
    description: d.description
  }))
}

export async function getDeckById(
  supabase: SupabaseClient,
  id: string
): Promise<DeckWithGameId | null> {
  const { data, error } = await supabase
    .from("decks")
    .select("*")
    .eq("id", id)
    .single()

  if (error && error.code !== "PGRST116") throw error
  if (!data) return null

  return {
    id: data.id,
    gameId: data.game_id,
    name: data.name,
    type: data.type,
    description: data.description
  }
}

export async function createDeck(
  supabase: SupabaseClient,
  deck: Omit<DeckWithGameId, "id">
): Promise<DeckWithGameId> {
  const { data, error } = await supabase
    .from("decks")
    .insert([
      {
        game_id: deck.gameId,
        name: deck.name,
        type: deck.type,
        description: deck.description
      }
    ])
    .select()
    .single()

  if (error) throw error
  return {
    id: data.id,
    gameId: data.game_id,
    name: data.name,
    type: data.type,
    description: data.description
  }
}

export async function updateDeck(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Omit<DeckWithGameId, "id" | "gameId">>
): Promise<DeckWithGameId> {
  const payload: any = {}
  if (updates.name) payload.name = updates.name
  if (updates.type) payload.type = updates.type
  if (updates.description) payload.description = updates.description

  const { data, error } = await supabase
    .from("decks")
    .update(payload)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return {
    id: data.id,
    gameId: data.game_id,
    name: data.name,
    type: data.type,
    description: data.description
  }
}

export async function deleteDeck(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("decks").delete().eq("id", id)

  if (error) throw error
}
