'use client'

import { useState, useEffect } from 'react'
import { Loader2, Palette } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { CreateTagPayload, Service, Tag } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

const PRESET_COLORS = [
  '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7',
  '#EC4899', '#EF4444', '#F97316', '#F59E0B',
  '#EAB308', '#22C55E', '#10B981', '#14B8A6',
  '#06B6D4', '#0EA5E9', '#6B7280', '#78716C',
]

interface TagModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  services: Service[]
  tag?: Tag | null
  onSave: (data: CreateTagPayload) => Promise<void>
}

export function TagModal({
  open,
  onOpenChange,
  services,
  tag,
  onSave,
}: TagModalProps) {
  const t = useTranslations('Tags')
  const tCommon = useTranslations('Common')
  
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3B82F6')
  const [selectedServices, setSelectedServices] = useState<number[]>([])

  const isEditing = !!tag

  useEffect(() => {
    if (open) {
      if (tag) {
        setName(tag.name)
        setColor(tag.color)
        // Pre-select services associated with the tag
        const serviceIds = tag.tagServices
          ? tag.tagServices.map((ts) => ts.serviceId)
          : tag.services
            ? tag.services.map((s) => s.id)
            : []
        setSelectedServices(serviceIds)
      } else {
        setName('')
        setColor('#3B82F6')
        setSelectedServices([])
      }
    }
  }, [open, tag])

  const toggleService = (id: number) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await onSave({
        name,
        color,
        servicesId: selectedServices.length > 0 ? selectedServices : undefined,
      })
      onOpenChange(false)
    } catch {
      // Error handling is done by the caller
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-full sm:max-w-md h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[90vh] rounded-none sm:rounded-xl overflow-y-auto p-4 sm:p-6 border-0 sm:border">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('editTag') : t('newTag')}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? t('editTagDesc')
              : t('newTagDesc')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tag-name">{tCommon('name')}</Label>
            <Input
              id="tag-name"
              placeholder={t('placeholderName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Palette className="size-4 text-zinc-500" />
              {t('color')}
            </Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`size-7 rounded-full border-2 transition-all hover:scale-110 ${
                    color === c
                      ? 'border-white scale-110 ring-2 ring-white/20'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div
                className="size-7 rounded-full border border-zinc-700 shrink-0"
                style={{ backgroundColor: color }}
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#HEX"
                className="font-mono text-sm"
              />
            </div>
          </div>

          {services.length > 0 && (
            <div className="space-y-2">
              <Label>{t('associatedServicesOptional')}</Label>
              <div className="max-h-36 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/50 p-2 space-y-1">
                {services.map((svc) => {
                  const checked = selectedServices.includes(svc.id)
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => toggleService(svc.id)}
                      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                        checked
                          ? 'bg-blue-600/15 text-blue-400'
                          : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                      }`}
                    >
                      <div
                        className={`size-4 rounded border flex items-center justify-center transition-colors ${
                          checked
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-zinc-600 bg-transparent'
                        }`}
                      >
                        {checked && (
                          <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="flex-1 text-left">{svc.name}</span>
                      <span className="text-xs text-zinc-500 font-mono">
                        {svc.protocol}:{svc.port}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading && <Loader2 className="size-4 animate-spin" />}
              {isEditing ? tCommon('save') : tCommon('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
