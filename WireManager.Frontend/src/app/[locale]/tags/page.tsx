"use client";
import { useTranslations } from "next-intl";


import { useState, useEffect, useCallback } from "react";
import { Plus, Tags as TagsIcon, Trash2, Pencil, Server, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AuthenticatedLayout } from "@/components/authenticated-layout";
import { useAuth } from "@/lib/auth-context";
import { TagModal } from "@/components/tag-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ViewToggle, type ViewMode } from "@/components/view-toggle";
import {
  getTags,
  getServices,
  createTag,
  updateTag,
  deleteTag,
  ApiClientError,
} from "@/lib/api-client";
import type { Tag, Service, CreateTagPayload } from "@/lib/types";

export default function TagsPage() {
  const tTags = useTranslations("Tags");
  const tCommon = useTranslations("Common");

  const { userRole } = useAuth();
  const [tags, setTags] = useState<Tag[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('wm-view-tags');
      if (saved === 'grid' || saved === 'list') return saved;
    }
    return 'grid';
  });

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [tagsData, servicesData] = await Promise.all([
        getTags(),
        getServices(),
      ]);
      setTags(tagsData);
      setServices(servicesData);
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : tTags("loadError");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleOpenCreate() {
    setEditingTag(null);
    setModalOpen(true);
  }

  function handleOpenEdit(tag: Tag) {
    setEditingTag(tag);
    setModalOpen(true);
  }

  async function handleSaveTag(data: CreateTagPayload) {
    try {
      if (editingTag) {
        await updateTag(editingTag.id, data);
        toast.success(tTags("updated"));
      } else {
        await createTag(data);
        toast.success(tTags("created"));
      }
      setEditingTag(null);
      await fetchData();
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : tTags("saveError");
      toast.error(message);
      throw err;
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteTag(deleteTarget.id);
      toast.success(tTags("deleted"));
      setDeleteTarget(null);
      await fetchData();
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : tTags("deleteError");
      toast.error(message);
    }
  }

  return (
    <AuthenticatedLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
              Tags
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {tTags("subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <ViewToggle value={viewMode} onChange={(m) => { setViewMode(m); localStorage.setItem('wm-view-tags', m); }} />
            {userRole === "Admin" && (
              <Button
                id="add-tag-btn"
                onClick={handleOpenCreate}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-500 hover:to-blue-600 shadow-lg shadow-blue-600/20 flex-1 sm:flex-none"
              >
                <Plus className="mr-2 h-4 w-4" />
                {tTags("newTag")}
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          viewMode === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-44 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50"
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
              <div className="space-y-0">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 border-b border-zinc-800 p-4 last:border-b-0"
                  >
                    <div className="h-4 w-4 animate-pulse rounded-full bg-zinc-800" />
                    <div className="h-4 w-28 animate-pulse rounded bg-zinc-800" />
                    <div className="h-4 w-16 animate-pulse rounded bg-zinc-800" />
                    <div className="h-4 w-40 animate-pulse rounded bg-zinc-800" />
                    <div className="ml-auto h-4 w-8 animate-pulse rounded bg-zinc-800" />
                  </div>
                ))}
              </div>
            </div>
          )
        ) : tags.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 py-20">
            <TagsIcon className="h-12 w-12 text-zinc-700" />
            <p className="mt-4 text-sm text-zinc-500">
              {tTags("noTags")}
            </p>
            {userRole === "Admin" && (
              <Button
                variant="outline"
                className="mt-4 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                onClick={handleOpenCreate}
              >
                <Plus className="mr-2 h-4 w-4" />
                {tTags("createFirst")}
              </Button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tags.map((tag, index) => (
              <div
                key={tag.id}
                className="animate-fade-in h-full"
                style={{
                  animationDelay: `${index * 80}ms`,
                  animationFillMode: "backwards",
                }}
              >
                <Card className="h-full flex flex-col">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="size-4 rounded-full shrink-0 ring-2 ring-white/10"
                          style={{ backgroundColor: tag.color }}
                        />
                        <CardTitle className="text-base">{tag.name}</CardTitle>
                      </div>
                      <Badge variant="secondary">ID: {tag.id}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1">
                    {(tag.tagServices && tag.tagServices.length > 0) || (tag.services && tag.services.length > 0) ? (
                      <div className="flex flex-col">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-2">
                          {tTags("associatedServices")}
                        </p>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {(tag.tagServices ? tag.tagServices.map(ts => ts.service) : tag.services!).map((svc) => (
                            <div
                              key={svc.id}
                              className="flex items-center gap-2 rounded-md bg-zinc-800/50 px-3 py-1.5 text-sm"
                            >
                              <Server className="size-3.5 text-zinc-500 shrink-0" />
                              <span className="text-zinc-300 truncate">{svc.name}</span>
                              <span className="ml-auto text-xs text-zinc-500 font-mono shrink-0">
                                {svc.protocol}:{svc.port}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500 italic">
                        {tTags("noAssociatedServices")}
                      </p>
                    )}
                  </CardContent>
                  {userRole === "Admin" && (
                    <CardFooter className="mt-auto gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                        onClick={() => handleOpenEdit(tag)}
                      >
                        <Pencil className="size-3.5" />
                        {tCommon("edit")}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteTarget(tag)}
                      >
                        <Trash2 className="size-3.5" />
                        {tCommon("delete")}
                      </Button>
                    </CardFooter>
                  )}
                </Card>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400 w-12">{tTags("color")}</TableHead>
                  <TableHead className="text-zinc-400">{tCommon("name")}</TableHead>
                  <TableHead className="text-zinc-400 w-20">ID</TableHead>
                  <TableHead className="text-zinc-400">{tTags("associatedServices")}</TableHead>
                  {userRole === "Admin" && (
                    <TableHead className="w-14 text-right text-zinc-400">{tCommon("actions")}</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tags.map((tag, index) => (
                  <TableRow
                    key={tag.id}
                    className="animate-fade-in border-zinc-800 hover:bg-zinc-800/50 transition-colors"
                    style={{
                      animationDelay: `${index * 50}ms`,
                      animationFillMode: "backwards",
                    }}
                  >
                    <TableCell>
                      <div
                        className="size-4 rounded-full ring-2 ring-white/10"
                        style={{ backgroundColor: tag.color }}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-zinc-200">
                      {tag.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">ID: {tag.id}</Badge>
                    </TableCell>
                    <TableCell className="text-zinc-400">
                      {(tag.tagServices && tag.tagServices.length > 0) || (tag.services && tag.services.length > 0) ? (
                        <div className="flex items-center gap-2">
                          <Server className="size-3.5 text-zinc-500 shrink-0" />
                          <span className="text-sm text-zinc-300">
                            {tag.tagServices
                              ? tag.tagServices.map(ts => ts.service.name).join(', ')
                              : tag.services!.map(s => s.name).join(', ')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-zinc-500 italic">{tTags("noAssociatedServices")}</span>
                      )}
                    </TableCell>
                    {userRole === "Admin" && (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => handleOpenEdit(tag)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              {tCommon("edit")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-400 focus:text-red-400"
                              onClick={() => setDeleteTarget(tag)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {tCommon("delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Modals */}
      <TagModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditingTag(null);
        }}
        services={services}
        tag={editingTag}
        onSave={handleSaveTag}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={tTags("deleteTitle")}
        description={tTags("deleteConfirm", { name: deleteTarget?.name ?? "" })}
        confirmLabel={tCommon("delete")}
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </AuthenticatedLayout>
  );
}
