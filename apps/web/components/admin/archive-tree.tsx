"use client";

import type { WordArchiveNode } from "@cosmere/shared";
import { FileText, FolderOpen, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Panel } from "../ui/panel";
import { cn } from "../../lib/utils";

/** 词库后台左侧：仓库/分类树 + 新建入口。重命名失焦保存，删除走上层确认。 */
export function ArchiveTree({
  archives,
  isTopAdmin,
  activeCategoryId,
  onSelectCategory,
  onCreateArchive,
  onRenameArchive,
  onDeleteArchive,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
  onLocalRename
}: {
  archives: WordArchiveNode[];
  isTopAdmin: boolean;
  activeCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
  onCreateArchive: (name: string) => Promise<boolean>;
  onRenameArchive: (id: string, name: string) => void;
  onDeleteArchive: (archive: WordArchiveNode) => void;
  onCreateCategory: (archiveId: string, name: string) => Promise<boolean>;
  onRenameCategory: (id: string, name: string) => void;
  onDeleteCategory: (archiveName: string, category: { id: string; name: string; count: number }) => void;
  onLocalRename: (next: WordArchiveNode[]) => void;
}) {
  const [newArchiveName, setNewArchiveName] = useState("");
  const [newCategoryArchiveId, setNewCategoryArchiveId] = useState(archives[0]?.id ?? "");
  const [newCategoryName, setNewCategoryName] = useState("");

  async function createArchive() {
    const name = newArchiveName.trim();
    if (!name) return;
    if (await onCreateArchive(name)) setNewArchiveName("");
  }

  async function createCategory() {
    const archiveId = newCategoryArchiveId || archives[0]?.id;
    const name = newCategoryName.trim();
    if (!archiveId || !name) return;
    if (await onCreateCategory(archiveId, name)) setNewCategoryName("");
  }

  return (
    <Panel className="self-start" title="题库结构" icon={<FolderOpen size={18} className="text-brass" />}>
      {/* 新建 */}
      <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.04] p-3">
        {isTopAdmin ? (
          <div className="flex gap-2">
            <Input
              value={newArchiveName}
              onChange={(event) => setNewArchiveName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && createArchive()}
              placeholder="新建一级仓库（如 三界宙）"
            />
            <Button className="h-11 shrink-0 px-3" onClick={createArchive} disabled={!newArchiveName.trim()}>
              <Plus size={16} />
            </Button>
          </div>
        ) : (
          <p className="text-xs text-white/40">一级仓库由顶级管理员维护，你可管理其下的二级分类与词条。</p>
        )}
        <div className="flex gap-2">
          <select
            value={newCategoryArchiveId}
            onChange={(event) => setNewCategoryArchiveId(event.target.value)}
            className="h-11 w-28 shrink-0 rounded-md border border-white/12 bg-black/25 px-2 text-sm"
            aria-label="选择所属仓库"
          >
            {archives.map((archive) => (
              <option key={archive.id} value={archive.id}>
                {archive.name}
              </option>
            ))}
          </select>
          <Input
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && createCategory()}
            placeholder="新建二级分类"
          />
          <Button className="h-11 shrink-0 px-3" onClick={createCategory} disabled={!newCategoryName.trim()}>
            <Plus size={16} />
          </Button>
        </div>
      </div>

      {/* 树 */}
      <div className="nice-scroll mt-4 max-h-[60vh] space-y-3 overflow-auto pr-1">
        {archives.map((archive) => (
          <div key={archive.id} className="rounded-lg border border-white/10 bg-white/[0.04] p-2">
            <div className="mb-1 flex items-center gap-1">
              {isTopAdmin ? (
                <input
                  value={archive.name}
                  onChange={(event) =>
                    onLocalRename(
                      archives.map((item) => (item.id === archive.id ? { ...item, name: event.target.value } : item))
                    )
                  }
                  onBlur={(event) => event.target.value.trim() && onRenameArchive(archive.id, event.target.value.trim())}
                  className="h-9 min-w-0 flex-1 rounded bg-transparent px-2 text-sm font-bold text-brass outline-none focus:bg-black/25"
                  aria-label="仓库名称"
                />
              ) : (
                <span className="h-9 min-w-0 flex-1 truncate px-2 py-1.5 text-sm font-bold text-brass">{archive.name}</span>
              )}
              {isTopAdmin ? (
                <button
                  type="button"
                  onClick={() => onDeleteArchive(archive)}
                  title="删除仓库"
                  className="shrink-0 rounded p-1.5 text-white/35 transition hover:bg-ember/15 hover:text-ember"
                >
                  <Trash2 size={15} />
                </button>
              ) : null}
            </div>

            {archive.categories.length === 0 ? (
              <p className="px-2 py-1 text-xs text-white/30">暂无分类</p>
            ) : null}

            {archive.categories.map((category) => {
              const active = activeCategoryId === category.id;
              return (
                <div
                  key={category.id}
                  className={cn(
                    "group flex items-center gap-1 rounded px-1.5 py-1.5 transition",
                    active ? "bg-storm/20" : "hover:bg-white/[0.07]"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectCategory(category.id)}
                    className="shrink-0 text-white/55"
                    aria-label={`选择分类 ${category.name}`}
                  >
                    <FileText size={15} />
                  </button>
                  <input
                    value={category.name}
                    onChange={(event) =>
                      onLocalRename(
                        archives.map((item) =>
                          item.id === archive.id
                            ? {
                                ...item,
                                categories: item.categories.map((inner) =>
                                  inner.id === category.id ? { ...inner, name: event.target.value } : inner
                                )
                              }
                            : item
                        )
                      )
                    }
                    onFocus={() => onSelectCategory(category.id)}
                    onBlur={(event) => event.target.value.trim() && onRenameCategory(category.id, event.target.value.trim())}
                    className="min-w-0 flex-1 rounded bg-transparent px-1 text-sm outline-none focus:bg-black/25"
                    aria-label="分类名称"
                  />
                  <span className="shrink-0 rounded bg-white/5 px-1.5 text-xs text-white/45">{category.count}</span>
                  <button
                    type="button"
                    onClick={() => onDeleteCategory(archive.name, category)}
                    title="删除分类"
                    className="shrink-0 rounded p-1 text-white/30 opacity-0 transition hover:bg-ember/15 hover:text-ember group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Panel>
  );
}
