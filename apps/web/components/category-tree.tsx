"use client";

import type { WordArchiveNode } from "@cosmere/shared";
import { ChevronDown, Folder, FolderOpen } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

export function CategoryTree({
  tree,
  selected,
  onChange,
  readonly = false
}: {
  tree: WordArchiveNode[];
  selected: string[];
  onChange: (next: string[]) => void;
  readonly?: boolean;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(tree.map((archive) => [archive.id, true]))
  );
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const allCategoryIds = tree.flatMap((archive) => archive.categories.map((category) => category.id));
  const total = tree.reduce(
    (sum, archive) =>
      sum + archive.categories.reduce((inner, category) => inner + (selectedSet.has(category.id) ? category.count : 0), 0),
    0
  );

  function toggleCategory(categoryId: string) {
    if (readonly) return;
    const next = selectedSet.has(categoryId)
      ? selected.filter((item) => item !== categoryId)
      : [...selected, categoryId];
    onChange(next);
  }

  function setArchive(categoryIds: string[], enabled: boolean) {
    if (readonly) return;
    const next = new Set(selected);
    for (const categoryId of categoryIds) {
      if (enabled) next.add(categoryId);
      else next.delete(categoryId);
    }
    onChange([...next]);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/50">
        <span>
          已选 {selected.length}/{allCategoryIds.length} 个文件
        </span>
        <span>{total} 条可用词</span>
      </div>
      <div className="max-h-[48vh] space-y-2 overflow-auto pr-1">
        {tree.map((archive) => {
          const archiveOpen = open[archive.id] ?? true;
          const categoryIds = archive.categories.map((category) => category.id);
          const checkedCount = categoryIds.filter((categoryId) => selectedSet.has(categoryId)).length;
          const allChecked = categoryIds.length > 0 && checkedCount === categoryIds.length;
          return (
            <div key={archive.id} className="rounded-md border border-white/10 bg-white/[0.035]">
              <div className="flex items-center gap-2 p-2">
                <button
                  type="button"
                  className="grid size-8 shrink-0 place-items-center rounded hover:bg-white/10"
                  onClick={() => setOpen((current) => ({ ...current, [archive.id]: !archiveOpen }))}
                >
                  <ChevronDown size={16} className={cn("transition", archiveOpen ? "" : "-rotate-90")} />
                </button>
                {archiveOpen ? <FolderOpen size={18} className="shrink-0 text-brass" /> : <Folder size={18} className="shrink-0 text-brass" />}
                <span className="min-w-0 flex-1 truncate font-semibold">{archive.name}</span>
                {!readonly ? (
                  <Button
                    type="button"
                    className="shrink-0 px-2 py-1 text-xs"
                    onClick={() => setArchive(categoryIds, !allChecked)}
                    disabled={categoryIds.length === 0}
                  >
                    {allChecked ? "全不选" : "全选"}
                  </Button>
                ) : null}
              </div>
              {archiveOpen ? (
                <div className="border-t border-white/8 px-3 pb-3 pt-1">
                  {archive.categories.map((category) => (
                    <label
                      key={category.id}
                      className="flex cursor-pointer items-center gap-3 rounded px-2 py-2 text-sm hover:bg-white/[0.05]"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSet.has(category.id)}
                        disabled={readonly}
                        onChange={() => toggleCategory(category.id)}
                      />
                      <span className="min-w-0 flex-1 truncate">{category.name}</span>
                      <span className="shrink-0 text-xs text-white/42">{category.count}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
