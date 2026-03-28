"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { deleteGame } from "@/app/actions"
import ConfirmModal from "@/components/editor/ConfirmModal"

export default function DeleteGameCard({ gameId }: { gameId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState("")
  const [openModal, setOpenModal] = useState(false)

  const onDelete = () => {
    setErrorMessage("")
    startTransition(async () => {
      try {
        await deleteGame(gameId)
        window.dispatchEvent(new Event("games:refresh"))
        router.push("/editor")
      } catch (error) {
        setErrorMessage("No se pudo eliminar el juego. Intenta de nuevo.")
        console.error("Error deleting game from settings:", error)
      } finally {
        setOpenModal(false)
      }
    })
  }

  return (
    <>
      <section className="rounded-lg border border-red-900/70 bg-red-950/20">
        <div className="border-b border-red-900/70 px-5 py-3">
          <h2 className="text-sm font-semibold text-red-300">Danger Zone</h2>
        </div>
        <div className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-100">Eliminar juego</p>
            <p className="mt-1 text-sm text-slate-400">
              Se borraran decks, cartas, variables y configuraciones asociadas.
            </p>
            {errorMessage && <p className="mt-2 text-sm text-red-300">{errorMessage}</p>}
          </div>

          <button
            type="button"
            onClick={() => setOpenModal(true)}
            disabled={isPending}
            className="rounded-md border border-red-400/70 bg-red-600/20 px-4 py-2 text-sm font-semibold text-red-200 transition-colors hover:bg-red-600/35 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Eliminando..." : "Eliminar juego"}
          </button>
        </div>
      </section>

      <ConfirmModal
        open={openModal}
        title="Eliminar juego"
        message="Esto eliminara el juego y todos sus datos asociados (decks, cartas, opciones, efectos, variables y configuracion). Esta accion no se puede deshacer."
        confirmLabel="Si, eliminar juego"
        onConfirm={onDelete}
        onCancel={() => setOpenModal(false)}
      />
    </>
  )
}
