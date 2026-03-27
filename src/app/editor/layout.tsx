import { ReactNode } from "react"
import EditorSidebar from "@/components/editor/EditorSidebar"

export default function EditorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-900 text-slate-100">
      <EditorSidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
