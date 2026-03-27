import { SupabaseClient } from "@supabase/supabase-js"
import { Condition } from "@/lib/domain"

export async function getConditionsByCardId(
  supabase: SupabaseClient,
  cardId: string
): Promise<Condition[]> {
  const { data, error } = await supabase
    .from("conditions")
    .select("*")
    .eq("card_id", cardId)

  if (error) throw error
  return (data || []).map((c: any) => ({
    id: c.id,
    type: c.type,
    key: c.key,
    value: c.value
  }))
}

export async function createCondition(
  supabase: SupabaseClient,
  cardId: string,
  condition: Omit<Condition, "id">
): Promise<Condition> {
  const { data, error } = await supabase
    .from("conditions")
    .insert([
      {
        card_id: cardId,
        type: condition.type,
        key: condition.key,
        value: condition.value
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

export async function updateCondition(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Omit<Condition, "id">>
): Promise<Condition> {
  const payload: any = {}
  if (updates.type) payload.type = updates.type
  if (updates.key) payload.key = updates.key
  if (updates.value !== undefined) payload.value = updates.value

  const { data, error } = await supabase
    .from("conditions")
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

export async function deleteCondition(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("conditions").delete().eq("id", id)

  if (error) throw error
}
