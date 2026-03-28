"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { deleteDeck } from "@/app/actions"
import ConfirmModal from "@/components/editor/ConfirmModal"

export default function DeleteDeckCard({
  gameId,
  deckId,
}: {
  gameId: string
  deckId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState("")
  const [openModal, setOpenModal] = useState(false)

  const onDelete = () => {
    setErrorMessage("")
    startTransition(async () => {
      try {
        await deleteDeck(deckId, gameId)
        router.push(`/editor/${gameId}`)
      } catch (error) {
        setErrorMessage("No se pudo eliminar el deck. Intenta de nuevo.")
        console.error("Error deleting deck from settings:", error)
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
            <p className="text-sm font-medium text-slate-100">Eliminar deck</p>
            <p className="mt-1 text-sm text-slate-400">
              Se borraran todas las cartas, opciones y efectos asociados a este deck.
            </p>
            {errorMessage && <p className="mt-2 text-sm text-red-300">{errorMessage}</p>}
          </div>

          <button
            type="button"
            onClick={() => setOpenModal(true)}
            disabled={isPending}
            className="rounded-md border border-red-400/70 bg-red-600/20 px-4 py-2 text-sm font-semibold text-red-200 transition-colors hover:bg-red-600/35 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Eliminando..." : "Eliminar deck"}
          </button>
        </div>
      </section>

      <ConfirmModal
        open={openModal}
        title="Eliminar deck"
        message="Esto eliminara el deck y sus cartas, opciones, condiciones y efectos asociados. Esta accion no se puede deshacer."
        confirmLabel="Si, eliminar deck"
        onConfirm={onDelete}
        onCancel={() => setOpenModal(false)}
      />
    </>
  )
}
