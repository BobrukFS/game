export default function EditorLoading() {
  return (
    <div className="p-8">
      <div className="mb-4 h-6 w-40 animate-pulse rounded bg-slate-700/70" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-lg border border-slate-700 bg-slate-800/70" />
        ))}
      </div>
    </div>
  )
}
