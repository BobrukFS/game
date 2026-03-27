import { SupabaseClient } from "@supabase/supabase-js"
import { Effect } from "@/lib/domain"

export async function getEffectsByOptionId(
  supabase: SupabaseClient,
  optionId: string
): Promise<Effect[]> {
  const { data, error } = await supabase
    .from("effects")
    .select("*")
    .eq("option_id", optionId)

  if (error) throw error
  return (data || []).map((e: any) => ({
    id: e.id,
    type: e.type,
    key: e.key,
    value: e.value
  }))
}

export async function createEffect(
  supabase: SupabaseClient,
  optionId: string,
  effect: Omit<Effect, "id">
): Promise<Effect> {
  const { data, error } = await supabase
    .from("effects")
    .insert([
      {
        option_id: optionId,
        type: effect.type,
        key: effect.key,
        value: effect.value
      }
    ])
    .select()
    .single()

  if (error) throw error
  return {
    id: data.id,
    type: data.type,
    key: data.key,
    value: data.value
  }
}

export async function updateEffect(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Omit<Effect, "id">>
): Promise<Effect> {
  const payload: any = {}
  if (updates.type) payload.type = updates.type
  if (updates.key) payload.key = updates.key
  if (updates.value !== undefined) payload.value = updates.value

  const { data, error } = await supabase
    .from("effects")
    .update(payload)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return {
    id: data.id,
    type: data.type,
    key: data.key,
    value: data.value
  }
}

export async function deleteEffect(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("effects").delete().eq("id", id)

  if (error) throw error
}
