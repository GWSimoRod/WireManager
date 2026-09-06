'use client'

import { LayoutGrid, List } from 'lucide-react'

export type ViewMode = 'grid' | 'list'

interface ViewToggleProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-800/50 p-0.5">
      <button
        type="button"
        onClick={() => onChange('grid')}
        className={`inline-flex items-center justify-center rounded-md p-1.5 transition-all ${
          value === 'grid'
            ? 'bg-zinc-700 text-zinc-100 shadow-sm'
            : 'text-zinc-500 hover:text-zinc-300'
        }`}
        title="Vista griglia"
      >
        <LayoutGrid className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange('list')}
        className={`inline-flex items-center justify-center rounded-md p-1.5 transition-all ${
          value === 'list'
            ? 'bg-zinc-700 text-zinc-100 shadow-sm'
            : 'text-zinc-500 hover:text-zinc-300'
        }`}
        title="Vista lista"
      >
        <List className="size-4" />
      </button>
    </div>
  )
}
