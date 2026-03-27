import { SupabaseClient } from "@supabase/supabase-js"
import { Stat } from "@/lib/domain"

export interface StatWithGameId extends Stat {
  gameId: string
}

export async function getAllStats(supabase: SupabaseClient): Promise<StatWithGameId[]> {
  const { data, error } = await supabase.from("global_stats").select("*")

  if (error) throw error
  return (data || []).map((s: any) => ({
    id: s.id,
    gameId: s.game_id,
    key: s.key,
    value: s.value,
    min: s.min,
    max: s.max
  }))
}

export async function getStatsByGameId(
  supabase: SupabaseClient,
  gameId: string
): Promise<StatWithGameId[]> {
  const { data, error } = await supabase
    .from("global_stats")
    .select("*")
    .eq("game_id", gameId)
    .order("key")

  if (error) throw error
  return (data || []).map((s: any) => ({
    id: s.id,
    gameId: s.game_id,
    key: s.key,
    value: s.value,
    min: s.min,
    max: s.max
  }))
}

export async function getStatByKey(
  supabase: SupabaseClient,
  gameId: string,
  key: string
): Promise<StatWithGameId | null> {
  const { data, error } = await supabase
    .from("global_stats")
    .select("*")
    .eq("game_id", gameId)
    .eq("key", key)
    .single()

  if (error && error.code !== "PGRST116") throw error
  if (!data) return null

  return {
    id: data.id,
    gameId: data.game_id,
    key: data.key,
    value: data.value,
    min: data.min,
    max: data.max
  }
}

export async function createStat(
  supabase: SupabaseClient,
  gameId: string,
  stat: Omit<Stat, "id">
): Promise<StatWithGameId> {
  const { data, error } = await supabase
    .from("global_stats")
    .insert([
      {
        game_id: gameId,
        key: stat.key,
        value: stat.value,
        min: stat.min ?? 0,
        max: stat.max ?? 100
      }
    ])
    .select()
    .single()

  if (error) throw error
  return {
    id: data.id,
    gameId: data.game_id,
    key: data.key,
    value: data.value,
    min: data.min,
    max: data.max
  }
}

export async function updateStat(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Omit<Stat, "id">>
): Promise<StatWithGameId> {
  const payload: any = {}
  if (updates.key) payload.key = updates.key
  if (updates.value !== undefined) payload.value = updates.value
  if (updates.min !== undefined) payload.min = updates.min
  if (updates.max !== undefined) payload.max = updates.max

  const { data, error } = await supabase
    .from("global_stats")
    .update(payload)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return {
    id: data.id,
    gameId: data.game_id,
    key: data.key,
    value: data.value,
    min: data.min,
    max: data.max
  }
}

export async function deleteStat(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("global_stats").delete().eq("id", id)

  if (error) throw error
}
