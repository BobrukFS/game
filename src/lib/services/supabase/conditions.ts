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
    dataType: c.data_type,
    operator: c.operator,
    key: c.key,
    value: c.value,
    logicOperator: c.logic_operator,
    order: c.order
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
        data_type: condition.dataType,
        operator: condition.operator,
        key: condition.key,
        value: condition.value,
        logic_operator: condition.logicOperator,
        order: condition.order
      }
    ])
    .select()
    .single()

  if (error) throw error
  return {
    id: data.id,
    dataType: data.data_type,
    operator: data.operator,
    key: data.key,
    value: data.value,
    logicOperator: data.logic_operator,
    order: data.order
  }
}

export async function updateCondition(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Omit<Condition, "id">>
): Promise<Condition> {
  const payload: any = {}
  if (updates.dataType) payload.data_type = updates.dataType
  if (updates.operator) payload.operator = updates.operator
  if (updates.key) payload.key = updates.key
  if (updates.value !== undefined) payload.value = updates.value
  if (updates.logicOperator) payload.logic_operator = updates.logicOperator
  if (updates.order !== undefined) payload.order = updates.order

  const { data, error } = await supabase
    .from("conditions")
    .update(payload)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return {
    id: data.id,
    dataType: data.data_type,
    operator: data.operator,
    key: data.key,
    value: data.value,
    logicOperator: data.logic_operator,
    order: data.order
  }
}

export async function deleteCondition(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("conditions").delete().eq("id", id)

  if (error) throw error
}
