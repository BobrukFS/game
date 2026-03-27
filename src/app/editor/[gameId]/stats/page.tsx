"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import {
  fetchStatsByGameId,
  createStat,
  updateStat,
  deleteStat,
  fetchWorldStatesByGameId,
  createWorldState,
  updateWorldState,
  deleteWorldState,
} from "@/app/actions"
import { Stat } from "@/lib/domain"

type WorldStateItem = {
  id: string
  gameId: string
  key: string
  valueType: "number" | "string" | "boolean"
  value: string
}

export default function StatsPage() {
  const params = useParams()
  const gameId = params.gameId as string

  const [stats, setStats] = useState<Stat[]>([])
  const [worldStates, setWorldStates] = useState<WorldStateItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [showStatForm, setShowStatForm] = useState(false)
  const [showWorldStateForm, setShowWorldStateForm] = useState(false)

  const [editingStatId, setEditingStatId] = useState<string | null>(null)
  const [editingWorldStateId, setEditingWorldStateId] = useState<string | null>(null)

  const [feedback, setFeedback] = useState<string>("")

  const [statForm, setStatForm] = useState({
    key: "",
    value: 0,
    min: 0,
    max: 100,
  })

  const [worldStateForm, setWorldStateForm] = useState<{
    key: string
    valueType: "number" | "string" | "boolean"
    value: string
  }>({
    key: "",
    valueType: "number",
    value: "0",
  })

  useEffect(() => {
    loadAll()
  }, [gameId])

  async function loadAll() {
    try {
      setIsLoading(true)
      const [statsData, worldData] = await Promise.all([
        fetchStatsByGameId(gameId),
        fetchWorldStatesByGameId(gameId),
      ])
      setStats(statsData)
      setWorldStates(worldData as WorldStateItem[])
    } catch (error) {
      console.error("Error loading stats/world states:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const statKeys = useMemo(() => new Set(stats.map((s) => s.key)), [stats])
  const worldKeys = useMemo(() => new Set(worldStates.map((w) => w.key)), [worldStates])

  async function handleSubmitStat(e: React.FormEvent) {
    e.preventDefault()
    setFeedback("")

    const key = statForm.key.trim()
    if (!editingStatId && !key) {
      setFeedback("La key del stat es obligatoria")
      return
    }

    if (!Number.isInteger(statForm.value) || !Number.isInteger(statForm.min) || !Number.isInteger(statForm.max)) {
      setFeedback("Stat: value/min/max deben ser enteros")
      return
    }

    if (statForm.min > statForm.max) {
      setFeedback("Stat: minimo no puede ser mayor que maximo")
      return
    }

    if (statForm.value < statForm.min || statForm.value > statForm.max) {
      setFeedback("Stat: value debe estar dentro del rango")
      return
    }

    if (!editingStatId && statKeys.has(key)) {
      setFeedback("Ya existe un stat con esa key")
      return
    }

    try {
      if (editingStatId) {
        await updateStat(editingStatId, gameId, {
          value: statForm.value,
          min: statForm.min,
          max: statForm.max,
        })
      } else {
        await createStat(gameId, {
          key,
          value: statForm.value,
          min: statForm.min,
          max: statForm.max,
        })
      }

      setEditingStatId(null)
      setStatForm({ key: "", value: 0, min: 0, max: 100 })
      setShowStatForm(false)
      await loadAll()
    } catch (error) {
      setFeedback("No se pudo guardar el stat")
      console.error("Error saving stat:", error)
    }
  }

  async function handleSubmitWorldState(e: React.FormEvent) {
    e.preventDefault()
    setFeedback("")

    const key = worldStateForm.key.trim()
    const rawValue = worldStateForm.value.trim()

    if (!editingWorldStateId && !key) {
      setFeedback("La key del world state es obligatoria")
      return
    }

    if (!rawValue) {
      setFeedback("El valor del world state es obligatorio")
      return
    }

    if (!editingWorldStateId && worldKeys.has(key)) {
      setFeedback("Ya existe un world state con esa key")
      return
    }

    if (worldStateForm.valueType === "number" && Number.isNaN(Number(rawValue))) {
      setFeedback("World state numerico requiere un valor numerico")
      return
    }

    if (
      worldStateForm.valueType === "boolean" &&
      rawValue !== "true" &&
      rawValue !== "false"
    ) {
      setFeedback("World state booleano debe ser true o false")
      return
    }

    try {
      if (editingWorldStateId) {
        await updateWorldState(editingWorldStateId, gameId, {
          key,
          valueType: worldStateForm.valueType,
          value: rawValue,
        })
      } else {
        await createWorldState(gameId, {
          key,
          valueType: worldStateForm.valueType,
          value: rawValue,
        })
      }

      setEditingWorldStateId(null)
      setWorldStateForm({ key: "", valueType: "number", value: "0" })
      setShowWorldStateForm(false)
      await loadAll()
    } catch (error) {
      setFeedback("No se pudo guardar el world state")
      console.error("Error saving world state:", error)
    }
  }

  function handleEditStat(stat: Stat) {
    setEditingStatId(stat.id)
    setStatForm({
      key: stat.key,
      value: stat.value,
      min: stat.min ?? 0,
      max: stat.max ?? 100,
    })
    setShowStatForm(true)
  }

  function handleEditWorldState(item: WorldStateItem) {
    setEditingWorldStateId(item.id)
    setWorldStateForm({
      key: item.key,
      valueType: item.valueType,
      value: item.value,
    })
    setShowWorldStateForm(true)
  }

  async function handleDeleteStat(statId: string) {
    if (!confirm("Eliminar este stat?")) return
    try {
      await deleteStat(statId, gameId)
      await loadAll()
    } catch (error) {
      console.error("Error deleting stat:", error)
    }
  }

  async function handleDeleteWorldState(worldStateId: string) {
    if (!confirm("Eliminar este world state?")) return
    try {
      await deleteWorldState(worldStateId, gameId)
      await loadAll()
    } catch (error) {
      console.error("Error deleting world state:", error)
    }
  }

  function resetStatForm() {
    setEditingStatId(null)
    setStatForm({ key: "", value: 0, min: 0, max: 100 })
    setShowStatForm(false)
  }

  function resetWorldStateForm() {
    setEditingWorldStateId(null)
    setWorldStateForm({ key: "", valueType: "number", value: "0" })
    setShowWorldStateForm(false)
  }

  if (isLoading) return <div className="p-8">Cargando...</div>

  return (
    <div className="max-w-5xl p-8 space-y-10">
      <div>
        <h1 className="text-3xl font-bold">Variables del Juego</h1>
        <p className="text-slate-400 mt-2">Stats y World State se gestionan por separado y sin valores por defecto.</p>
      </div>

      {feedback && <p className="text-sm text-amber-300">{feedback}</p>}

      <section className="rounded bg-slate-800 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Stats</h2>
          <button
            onClick={() => setShowStatForm((prev) => !prev)}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white"
          >
            {showStatForm ? "Cerrar" : "+ Nuevo Stat"}
          </button>
        </div>

        {showStatForm && (
          <form onSubmit={handleSubmitStat} className="space-y-4 rounded bg-slate-900/40 p-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Key</label>
              <input
                type="text"
                value={statForm.key}
                onChange={(e) => setStatForm((prev) => ({ ...prev, key: e.target.value }))}
                className="w-full px-4 py-2 bg-slate-700 rounded text-white"
                disabled={editingStatId !== null}
                required
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Value</label>
                <input
                  type="number"
                  value={statForm.value}
                  onChange={(e) => setStatForm((prev) => ({ ...prev, value: Number(e.target.value) }))}
                  className="w-full px-4 py-2 bg-slate-700 rounded text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Min</label>
                <input
                  type="number"
                  value={statForm.min}
                  onChange={(e) => setStatForm((prev) => ({ ...prev, min: Number(e.target.value) }))}
                  className="w-full px-4 py-2 bg-slate-700 rounded text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Max</label>
                <input
                  type="number"
                  value={statForm.max}
                  onChange={(e) => setStatForm((prev) => ({ ...prev, max: Number(e.target.value) }))}
                  className="w-full px-4 py-2 bg-slate-700 rounded text-white"
                  required
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white">
                {editingStatId ? "Actualizar" : "Crear"}
              </button>
              <button type="button" onClick={resetStatForm} className="flex-1 bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded text-white">
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {stats.length === 0 ? (
            <p className="text-slate-400">No hay stats definidos</p>
          ) : (
            stats.map((stat) => (
              <div key={stat.id} className="bg-slate-700/50 p-4 rounded flex justify-between items-center">
                <div>
                  <p className="font-semibold text-lg">{stat.key}</p>
                  <p className="text-slate-400 text-sm">Value: {stat.value} | Rango: {stat.min} - {stat.max}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEditStat(stat)} className="bg-yellow-600 hover:bg-yellow-700 px-3 py-2 rounded text-white text-sm">Editar</button>
                  <button onClick={() => handleDeleteStat(stat.id)} className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded text-white text-sm">Eliminar</button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded bg-slate-800 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">World State</h2>
          <button
            onClick={() => setShowWorldStateForm((prev) => !prev)}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white"
          >
            {showWorldStateForm ? "Cerrar" : "+ Nuevo World State"}
          </button>
        </div>

        {showWorldStateForm && (
          <form onSubmit={handleSubmitWorldState} className="space-y-4 rounded bg-slate-900/40 p-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Key</label>
              <input
                type="text"
                value={worldStateForm.key}
                onChange={(e) => setWorldStateForm((prev) => ({ ...prev, key: e.target.value }))}
                className="w-full px-4 py-2 bg-slate-700 rounded text-white"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Tipo de valor</label>
                <select
                  value={worldStateForm.valueType}
                  onChange={(e) =>
                    setWorldStateForm((prev) => ({
                      ...prev,
                      valueType: e.target.value as "number" | "string" | "boolean",
                      value: e.target.value === "boolean" ? "false" : prev.value,
                    }))
                  }
                  className="w-full px-4 py-2 bg-slate-700 rounded text-white"
                >
                  <option value="number">number</option>
                  <option value="string">string</option>
                  <option value="boolean">boolean</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Value</label>
                {worldStateForm.valueType === "boolean" ? (
                  <select
                    value={worldStateForm.value}
                    onChange={(e) => setWorldStateForm((prev) => ({ ...prev, value: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-700 rounded text-white"
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <input
                    type={worldStateForm.valueType === "number" ? "number" : "text"}
                    value={worldStateForm.value}
                    onChange={(e) => setWorldStateForm((prev) => ({ ...prev, value: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-700 rounded text-white"
                    required
                  />
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white">
                {editingWorldStateId ? "Actualizar" : "Crear"}
              </button>
              <button type="button" onClick={resetWorldStateForm} className="flex-1 bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded text-white">
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {worldStates.length === 0 ? (
            <p className="text-slate-400">No hay world states definidos</p>
          ) : (
            worldStates.map((item) => (
              <div key={item.id} className="bg-slate-700/50 p-4 rounded flex justify-between items-center">
                <div>
                  <p className="font-semibold text-lg">{item.key}</p>
                  <p className="text-slate-400 text-sm">{item.valueType}: {item.value}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEditWorldState(item)} className="bg-yellow-600 hover:bg-yellow-700 px-3 py-2 rounded text-white text-sm">Editar</button>
                  <button onClick={() => handleDeleteWorldState(item.id)} className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded text-white text-sm">Eliminar</button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
