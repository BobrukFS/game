import { prisma } from "@/lib/prisma"

type NarrativeGroupKey =
  | "character"
  | "place"
  | "event"
  | "story_main"
  | "story_secondary"
  | "other"

const GROUP_ORDER: NarrativeGroupKey[] = [
  "character",
  "place",
  "event",
  "story_main",
  "story_secondary",
  "other",
]

const GROUP_LABEL: Record<NarrativeGroupKey, string> = {
  character: "Personajes",
  place: "Lugares",
  event: "Eventos",
  story_main: "Historia Principal",
  story_secondary: "Historias Secundarias",
  other: "Otros",
}

type CardSelection = {
  id: string
  title: string
  deck: {
    id: string
    name: string
  }
  tags: string[]
}

type TagBucket = {
  tag: string
  entity: string
  type: string
  notionUrl?: string
  cards: CardSelection[]
}

type ParsedNarrativeTag = {
  type: string
  entity: string
  groupKey: NarrativeGroupKey
}

function normalizeEntity(value: string): string {
  return value.trim().toLowerCase()
}

function parseNotionMetaTag(tag: string): { type: string; entity: string; notionUrl: string } | null {
  const match = /^notion:(character|place|event|story):([^:]+):(https?:\/\/.+)$/i.exec(tag.trim())
  if (!match) {
    return null
  }

  const [, type, entity, notionUrl] = match
  return {
    type: type.toLowerCase(),
    entity: entity.trim(),
    notionUrl: notionUrl.trim(),
  }
}

function parseNarrativeTag(tag: string): ParsedNarrativeTag | null {
  const [prefix, ...rest] = tag.split(":")
  const type = (prefix || "").trim().toLowerCase()
  if (!type || rest.length === 0) {
    return null
  }

  const rawEntity = rest.join(":").trim()
  if (!rawEntity) {
    return null
  }

  if (type === "character") {
    return { type, entity: rawEntity, groupKey: "character" }
  }

  if (type === "place") {
    return { type, entity: rawEntity, groupKey: "place" }
  }

  if (type === "event") {
    return { type, entity: rawEntity, groupKey: "event" }
  }

  if (type === "story") {
    const entityLower = rawEntity.toLowerCase()
    if (entityLower.startsWith("main:") || entityLower.startsWith("principal:")) {
      const entity = rawEntity.split(":").slice(1).join(":").trim() || rawEntity
      return { type, entity, groupKey: "story_main" }
    }
    if (
      entityLower.startsWith("secondary:") ||
      entityLower.startsWith("secundaria:") ||
      entityLower.startsWith("side:")
    ) {
      const entity = rawEntity.split(":").slice(1).join(":").trim() || rawEntity
      return { type, entity, groupKey: "story_secondary" }
    }
    return { type, entity: rawEntity, groupKey: "story_secondary" }
  }

  return { type, entity: rawEntity, groupKey: "other" }
}

function normalizeTag(type: string, entity: string): string {
  return `${type.trim().toLowerCase()}:${normalizeEntity(entity)}`
}

function uniqueDecks(cards: CardSelection[]) {
  const deckMap = new Map<string, { id: string; name: string }>()

  for (const card of cards) {
    deckMap.set(card.deck.id, {
      id: card.deck.id,
      name: card.deck.name,
    })
  }

  return Array.from(deckMap.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export async function getNarrativeTagIndex(gameId: string) {
  const cards = await prisma.card.findMany({
    where: {
      deck: { gameId },
      tags: {
        isEmpty: false,
      },
    },
    select: {
      id: true,
      title: true,
      tags: true,
      deck: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ title: "asc" }],
  })

  const byGroup = new Map<NarrativeGroupKey, Map<string, TagBucket>>()
  const notionByEntity = new Map<string, string>()

  for (const card of cards as CardSelection[]) {
    for (const rawTag of card.tags || []) {
      const parsedMeta = parseNotionMetaTag(rawTag)
      if (!parsedMeta) continue

      notionByEntity.set(normalizeTag(parsedMeta.type, parsedMeta.entity), parsedMeta.notionUrl)
    }
  }

  for (const card of cards as CardSelection[]) {
    for (const rawTag of card.tags || []) {
      const trimmedTag = (rawTag || "").trim()
      if (!trimmedTag) continue

      if (trimmedTag.toLowerCase().startsWith("notion:")) {
        continue
      }

      const parsed = parseNarrativeTag(trimmedTag)
      if (!parsed) continue

      const normalizedTag = normalizeTag(parsed.type, parsed.entity)
      if (!byGroup.has(parsed.groupKey)) {
        byGroup.set(parsed.groupKey, new Map<string, TagBucket>())
      }

      const group = byGroup.get(parsed.groupKey) as Map<string, TagBucket>
      if (!group.has(normalizedTag)) {
        group.set(normalizedTag, {
          tag: trimmedTag,
          entity: parsed.entity,
          type: parsed.type,
          notionUrl: notionByEntity.get(normalizeTag(parsed.type, parsed.entity)),
          cards: [],
        })
      }

      const bucket = group.get(normalizedTag) as TagBucket
      if (!bucket.notionUrl) {
        bucket.notionUrl = notionByEntity.get(normalizeTag(parsed.type, parsed.entity))
      }
      if (!bucket.cards.some((existing) => existing.id === card.id)) {
        bucket.cards.push(card)
      }
    }
  }

  const groups = GROUP_ORDER.map((groupKey) => {
    const buckets = Array.from(byGroup.get(groupKey)?.values() || [])
      .map((bucket) => ({
        tag: bucket.tag,
        entity: bucket.entity,
        type: bucket.type,
        notionUrl: bucket.notionUrl,
        cards: bucket.cards.sort((a, b) => a.title.localeCompare(b.title)),
        decks: uniqueDecks(bucket.cards),
      }))
      .sort((a, b) => a.entity.localeCompare(b.entity))

    return {
      key: groupKey,
      label: GROUP_LABEL[groupKey],
      tags: buckets,
      tagCount: buckets.length,
      cardCount: buckets.reduce((sum, item) => sum + item.cards.length, 0),
    }
  }).filter((group) => group.tags.length > 0)

  return {
    groups,
    tagCount: groups.reduce((sum, group) => sum + group.tagCount, 0),
    cardCount: cards.length,
  }
}
