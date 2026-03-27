"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { fetchGames, createGame, deleteGame } from "@/app/actions"
import { Game } from "@/lib/domain"

export default function EditorPage() {
  const [games, setGames] = useState<Game[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ name: "", description: "" })

  useEffect(() => {
    loadGames()
  }, [])

  async function loadGames() {
    try {
      setIsLoading(true)
      const data = await fetchGames()
      setGames(data)
    } catch (error) {
      console.error("Error loading games:", error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreateGame(e: React.FormEvent) {
    e.preventDefault()
    try {
      await createGame(formData)
      await loadGames()
      window.dispatchEvent(new Event("games:refresh"))
      setFormData({ name: "", description: "" })
      setShowForm(false)
    } catch (error) {
      console.error("Error creating game:", error)
    }
  }

  async function handleDeleteGame(id: string) {
    if (!confirm("¿Eliminar este juego?")) return
    try {
      await deleteGame(id)
      await loadGames()
      window.dispatchEvent(new Event("games:refresh"))
    } catch (error) {
      console.error("Error deleting game:", error)
    }
  }

  if (isLoading) return <div className="p-8">Cargando...</div>

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Juegos</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white"
        >
          {showForm ? "Cancelar" : "+ Nuevo Juego"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateGame} className="mb-8 bg-slate-800 p-6 rounded">
          <div className="mb-4">
            <label htmlFor="game-name" className="mb-2 block text-sm font-semibold text-slate-200">
              Nombre
            </label>
            <input
              id="game-name"
              type="text"
              placeholder="Nombre"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-slate-700 rounded text-white placeholder-slate-500"
              required
            />
          </div>
          <div className="mb-4">
            <label htmlFor="game-description" className="mb-2 block text-sm font-semibold text-slate-200">
              Descripcion
            </label>
            <textarea
              id="game-description"
              placeholder="Descripcion"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 bg-slate-700 rounded text-white placeholder-slate-500"
              rows={3}
            />
          </div>
          <button
            type="submit"
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white"
          >
            Crear
          </button>
        </form>
      )}

      <div className="grid gap-4">
        {games.map((game) => (
          <div key={game.id} className="bg-slate-800 p-6 rounded border border-slate-700 hover:border-slate-600">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <Link href={`/editor/${game.id}`}>
                  <h2 className="text-xl font-bold text-blue-400 hover:text-blue-300 cursor-pointer">
                    {game.name}
                  </h2>
                </Link>
                <p className="text-slate-400 mt-2">{game.description}</p>
                <p className="text-xs text-slate-500 mt-4">
                  {new Date(game.createdAt || "").toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => handleDeleteGame(game.id)}
                className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-white text-sm"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {games.length === 0 && (
        <p className="text-slate-400 text-center py-12">No hay juegos. Crea uno para comenzar.</p>
      )}
    </div>
  )
}
