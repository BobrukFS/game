"use client"

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
        <p className="mt-2 text-sm text-slate-300">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded border border-red-400/60 bg-red-600/20 px-3 py-1.5 text-sm font-semibold text-red-200 hover:bg-red-600/35"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
