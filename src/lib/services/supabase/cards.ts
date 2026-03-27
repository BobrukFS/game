import { SupabaseClient } from "@supabase/supabase-js"
import { Card, Condition, Effect, Option } from "@/lib/domain"

export interface CardWithRelations {
  id: string
  deckId: string
  title: string
  description: string
  weight: number
  priority?: number
  tags: string[]
  createdAt?: string
  conditions: Condition[]
  options?: (Option & { effects: Effect[] })[]
}

export async function getCardsByDeckId(
  supabase: SupabaseClient,
  deckId: string
): Promise<CardWithRelations[]> {
  const { data, error } = await supabase
    .from("cards")
    .select(
      `
      *,
      conditions(*),
      options(
        *,
        effects(*)
      )
    `
    )
    .eq("deck_id", deckId)
    .order("priority", { ascending: false })

  if (error) throw error
  return (data || []).map((card: any) => ({
    id: card.id,
    deckId: card.deck_id,
    title: card.title,
    description: card.description,
    weight: card.weight,
    priority: card.priority,
    tags: card.tags || [],
    createdAt: card.created_at,
    conditions: (card.conditions || []).map((c: any) => ({
      id: c.id,
      type: c.type,
      key: c.key,
      value: c.value
    })),
    options: (card.options || []).map((opt: any) => ({
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
  }))
}

export async function getCardById(
  supabase: SupabaseClient,
  id: string
): Promise<CardWithRelations | null> {
  const { data, error } = await supabase
    .from("cards")
    .select(
      `
      *,
      conditions(*),
      options(
        *,
        effects(*)
      )
    `
    )
    .eq("id", id)
    .single()

  if (error && error.code !== "PGRST116") throw error
  if (!data) return null

  return {
    id: data.id,
    deckId: data.deck_id,
    title: data.title,
    description: data.description,
    weight: data.weight,
    priority: data.priority,
    tags: data.tags || [],
    createdAt: data.created_at,
    conditions: (data.conditions || []).map((c: any) => ({
      id: c.id,
      type: c.type,
      key: c.key,
      value: c.value
    })),
    options: (data.options || []).map((opt: any) => ({
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
}

export async function createCard(
  supabase: SupabaseClient,
  card: Omit<Card, "id" | "createdAt" | "conditions" | "options">
): Promise<Omit<Card, "conditions" | "options">> {
  const { data, error } = await supabase
    .from("cards")
    .insert([
      {
        deck_id: card.deckId,
        title: card.title,
        description: card.description,
        weight: card.weight,
        priority: card.priority,
        tags: card.tags
      }
    ])
    .select()
    .single()

  if (error) throw error
  return {
    id: data.id,
    deckId: data.deck_id,
    title: data.title,
    description: data.description,
    weight: data.weight,
    priority: data.priority,
    tags: data.tags || [],
    createdAt: data.created_at
  }
}

export async function updateCard(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Omit<Card, "conditions" | "options" | "deckId" | "id">>
): Promise<Omit<Card, "conditions" | "options">> {
  const payload: any = {}
  if (updates.title) payload.title = updates.title
  if (updates.description) payload.description = updates.description
  if (updates.weight) payload.weight = updates.weight
  if (updates.priority !== undefined) payload.priority = updates.priority
  if (updates.tags) payload.tags = updates.tags

  const { data, error } = await supabase
    .from("cards")
    .update(payload)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return {
    id: data.id,
    deckId: data.deck_id,
    title: data.title,
    description: data.description,
    weight: data.weight,
    priority: data.priority,
    tags: data.tags || [],
    createdAt: data.created_at
  }
}

export async function deleteCard(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("cards").delete().eq("id", id)

  if (error) throw error
}
