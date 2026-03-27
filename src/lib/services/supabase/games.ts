import { SupabaseClient } from "@supabase/supabase-js"
import { Game } from "@/lib/domain"

export async function getAllGames(supabase: SupabaseClient): Promise<Game[]> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data || []).map((g: any) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    createdAt: g.created_at,
    updatedAt: g.updated_at
  }))
}

export async function getGameById(
  supabase: SupabaseClient,
  id: string
): Promise<Game | null> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .single()

  if (error && error.code !== "PGRST116") throw error
  if (!data) return null

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  }
}

export async function createGame(
  supabase: SupabaseClient,
  game: Omit<Game, "id" | "createdAt" | "updatedAt">
): Promise<Game> {
  const { data, error } = await supabase
    .from("games")
    .insert([
      {
        name: game.name,
        description: game.description
      }
    ])
    .select()
    .single()

  if (error) throw error
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  }
}

export async function updateGame(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Omit<Game, "id" | "createdAt" | "updatedAt">>
): Promise<Game> {
  const payload: any = {}
  if (updates.name) payload.name = updates.name
  if (updates.description) payload.description = updates.description

  const { data, error } = await supabase
    .from("games")
    .update(payload)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  }
}

export async function deleteGame(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("games").delete().eq("id", id)

  if (error) throw error
}
