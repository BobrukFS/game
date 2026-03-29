"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { fetchNarrativeTagIndex } from "@/app/actions"
import PathTrail from "@/components/editor/PathTrail"

type NarrativeDeckRef = {
  id: string
  name: string
}

type NarrativeCardRef = {
  id: string
  title: string
  deck: NarrativeDeckRef
}

type NarrativeTag = {
  tag: string
  type: string
  entity: string
  notionUrl?: string
  cards: NarrativeCardRef[]
  decks: NarrativeDeckRef[]
}

type NarrativeGroup = {
  key: string
  label: string
  tags: NarrativeTag[]
  tagCount: number
  cardCount: number
}

type NarrativeIndex = {
  groups: NarrativeGroup[]
  tagCount: number
  cardCount: number
}

function notionSearchLink(query: string): string {
  return `https://www.notion.so/search?query=${encodeURIComponent(query)}`
}

export default function NarrativePage() {
  const params = useParams()
  const gameId = params.gameId as string

  const [data, setData] = useState<NarrativeIndex | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    loadNarrative()
  }, [gameId])

  async function loadNarrative() {
    try {
      setIsLoading(true)
      setError("")
      const result = await fetchNarrativeTagIndex(gameId)
      setData(result as NarrativeIndex)
    } catch (err) {
      console.error("Error loading narrative index:", err)
      setError("No se pudo cargar la seccion narrativa")
    } finally {
      setIsLoading(false)
    }
  }

  const groups = useMemo(() => data?.groups || [], [data])

  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return groups

    return groups
      .map((group) => {
        const tags = group.tags
          .map((tagItem) => {
            const matchesTag = tagItem.tag.toLowerCase().includes(query)
            const matchesEntity = tagItem.entity.toLowerCase().includes(query)
            const matchingCards = tagItem.cards.filter((card) => card.title.toLowerCase().includes(query))

            if (matchesTag || matchesEntity) {
              return tagItem
            }

            if (matchingCards.length > 0) {
              return {
                ...tagItem,
                cards: matchingCards,
              }
            }

            return null
          })
          .filter((item): item is NarrativeTag => item !== null)

        return {
          ...group,
          tags,
          tagCount: tags.length,
          cardCount: tags.reduce((sum, item) => sum + item.cards.length, 0),
        }
      })
      .filter((group) => group.tags.length > 0)
  }, [groups, searchQuery])

  const visibleTagCount = useMemo(
    () => filteredGroups.reduce((sum, group) => sum + group.tagCount, 0),
    [filteredGroups]
  )

  const visibleCardCount = useMemo(
    () => filteredGroups.reduce((sum, group) => sum + group.cardCount, 0),
    [filteredGroups]
  )

  if (isLoading) {
    return <div className="p-8">Cargando narrativa...</div>
  }

  return (
    <div className="p-8">
      <PathTrail
        items={[
          { label: "Editor", href: "/editor" },
          { label: "Narrativa" },
        ]}
      />

      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-4xl font-bold">Narrativa</h1>
          <p className="mt-1 text-sm text-slate-400">
            Indice narrativo por tags ({visibleTagCount} tags, {visibleCardCount} referencias)
          </p>
        </div>
        <a
          href={notionSearchLink(`game:${gameId}`)}
          target="_blank"
          rel="noreferrer"
          className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
        >
          Abrir busqueda en Notion
        </a>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded border border-slate-700 bg-slate-800/40 p-3">
        <label htmlFor="narrative-search" className="text-xs uppercase tracking-wide text-slate-300">
          Buscar
        </label>
        <input
          id="narrative-search"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="tag, entidad o carta"
          className="min-w-[240px] flex-1 rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-400 focus:outline-none"
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="rounded border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700"
          >
            Limpiar
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded border border-red-500/40 bg-red-900/20 px-4 py-3 text-red-200">{error}</div>
      ) : null}

      {!error && filteredGroups.length === 0 ? (
        <div className="rounded border border-slate-700 bg-slate-800/60 p-6 text-slate-300">
          {searchQuery
            ? "No hay resultados para ese filtro."
            : "No hay tags narrativos todavia. Ejemplos: character:sally, place:harbor, event:storm, story:main:opening, story:secondary:market-drama."}
        </div>
      ) : null}

      {!error ? (
        <div className="mb-4 rounded border border-slate-700 bg-slate-800/40 p-3 text-xs text-slate-300">
          Tag de Notion exacto por entidad: notion:character:sally:https://www.notion.so/... (tambien funciona con place, event y story).
        </div>
      ) : null}

      <div className="space-y-6">
        {filteredGroups.map((group) => (
          <section key={group.key} className="rounded-lg border border-slate-700 bg-slate-800/50 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-2xl font-semibold text-slate-100">{group.label}</h2>
              <span className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-200">
                {group.tagCount} tags / {group.cardCount} referencias
              </span>
            </div>

            <div className="space-y-4">
              {group.tags.map((tagItem) => (
                <article key={tagItem.tag} className="rounded border border-slate-700/80 bg-slate-900/30 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-100">{tagItem.entity}</h3>
                      <p className="text-xs uppercase tracking-wide text-slate-400">{tagItem.tag}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {tagItem.notionUrl ? (
                        <a
                          href={tagItem.notionUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded border border-emerald-600/60 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-900/30"
                        >
                          Notion: ficha exacta
                        </a>
                      ) : null}
                      <a
                        href={notionSearchLink(tagItem.tag)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
                      >
                        Notion: tag
                      </a>
                      <a
                        href={notionSearchLink(tagItem.entity)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
                      >
                        Notion: entidad
                      </a>
                    </div>
                  </div>

                  <div className="mb-2 flex flex-wrap gap-2">
                    {tagItem.decks.map((deck) => (
                      <Link
                        key={deck.id}
                        href={`/editor/${gameId}/decks/${deck.id}`}
                        className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-100 hover:bg-slate-600"
                      >
                        Deck: {deck.name}
                      </Link>
                    ))}
                  </div>

                  <ul className="grid gap-2 md:grid-cols-2">
                    {tagItem.cards.map((card) => (
                      <li key={card.id}>
                        <Link
                          href={`/editor/${gameId}/cards/${card.id}`}
                          className="block rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:border-slate-500 hover:text-white"
                        >
                          <span className="font-medium">{card.title}</span>
                          <span className="ml-2 text-xs text-slate-400">({card.deck.name})</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
