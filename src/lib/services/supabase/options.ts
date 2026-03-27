import { SupabaseClient } from "@supabase/supabase-js"
import { Option, Effect } from "@/lib/domain"

export interface OptionWithEffects extends Option {
  effects: Effect[]
}

export async function getOptionsByCardId(
  supabase: SupabaseClient,
  cardId: string
): Promise<OptionWithEffects[]> {
  const { data, error } = await supabase
    .from("options")
    .select(
      `
      *,
      effects(*)
    `
    )
    .eq("card_id", cardId)
    .order("order", { ascending: true })

  if (error) throw error
  return (data || []).map((opt: any) => ({
    id: opt.id,
    cardId: opt.card_id,
    text: opt.text,
    order: opt.order,
    nextCardId: opt.next_card_id,
    effects: (opt.effects || []).map((eff: any) => ({
      id: eff.id,
      type: eff.type,
      key: eff.key,
      value: eff.value
    }))
  }))
}

export async function createOption(
  supabase: SupabaseClient,
  option: Omit<Option, "id">
): Promise<Option> {
  const { data, error } = await supabase
    .from("options")
    .insert([
      {
        card_id: option.cardId,
        text: option.text,
        order: option.order,
        next_card_id: option.nextCardId
      }
    ])
    .select()
    .single()

  if (error) throw error
  return {
    id: data.id,
    cardId: data.card_id,
    text: data.text,
    order: data.order,
    nextCardId: data.next_card_id,
    effects: []
  }
}

export async function updateOption(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Omit<Option, "id">>
): Promise<Option> {
  const payload: any = {}
  if (updates.text) payload.text = updates.text
  if (updates.order !== undefined) payload.order = updates.order
  if (updates.nextCardId !== undefined) payload.next_card_id = updates.nextCardId

  const { data, error } = await supabase
    .from("options")
    .update(payload)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return {
    id: data.id,
    cardId: data.card_id,
    text: data.text,
    order: data.order,
    nextCardId: data.next_card_id,
    effects: []
  }
}

export async function deleteOption(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("options").delete().eq("id", id)

  if (error) throw error
}
