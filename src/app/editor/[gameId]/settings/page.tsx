"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { fetchGameById, updateGame } from "@/app/actions"
import type { Game } from "@/lib/domain"
import DeleteGameCard from "@/components/editor/DeleteGameCard"
import PathTrail from "@/components/editor/PathTrail"

export default function GameSettingsPage() {
  const params = useParams()
  const gameId = params.gameId as string

  const [game, setGame] = useState<Game | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    description: "",
  })

  useEffect(() => {
    void loadGame()
  }, [gameId])

  async function loadGame() {
    try {
      setIsLoading(true)
      const gameData = await fetchGameById(gameId)
      if (gameData) {
        setGame(gameData)
        setFormData({
          name: gameData.name,
          description: gameData.description || "",
        })
      }
    } catch (error) {
      console.error("Error loading game:", error)
    } finally {
      setIsLoading(false)
    }
  }

  function handleEditToggle() {
    if (isEditing) {
      setFormData({
        name: game?.name || "",
        description: game?.description || "",
      })
    }
    setIsEditing((prev) => !prev)
  }

  async function handleSave() {
    if (!game || !isEditing) return

    const name = formData.name.trim()
    if (!name) return

    try {
      setIsSaving(true)
      await updateGame(gameId, {
        name,
        description: formData.description.trim(),
      })
      await loadGame()
      setIsEditing(false)
    } catch (error) {
      console.error("Error saving game:", error)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <div className="p-8">Cargando...</div>
  if (!game) return <div className="p-8">Juego no encontrado</div>

  return (
    <div className="min-h-full bg-slate-900 p-8 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="border-b border-slate-700 pb-4">
          <PathTrail
            items={[
              { label: "Editor", href: "/editor" },
              { label: "Configuracion de juego" },
            ]}
          />
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Configuracion</h1>
            {!isEditing && (
              <button
                onClick={handleEditToggle}
                className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
              >
                Editar
              </button>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Ajustes del juego con estilo limpio inspirado en GitHub.
          </p>
        </header>

        <section className="rounded-lg border border-slate-700 bg-slate-800/70">
          <div className="border-b border-slate-700 px-5 py-3">
            <h2 className="text-sm font-semibold">General</h2>
          </div>
          <div className="space-y-4 px-5 py-5">
            <div>
              <label htmlFor="game-name" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Nombre
              </label>
              <input
                id="game-name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                disabled={!isEditing}
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="game-description" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Descripcion
              </label>
              <textarea
                id="game-description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                disabled={!isEditing}
                rows={4}
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 disabled:opacity-60"
              />
            </div>
          </div>
        </section>

        {isEditing && (
          <div className="flex justify-end gap-2">
            <button
              onClick={handleEditToggle}
              disabled={isSaving}
              className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="rounded border border-emerald-400/60 bg-emerald-600/20 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-600/35 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        )}

        <DeleteGameCard gameId={gameId} />
      </div>
    </div>
  )
}
