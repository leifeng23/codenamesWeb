"use client";

import {
  ALL_WORD_CATEGORIES,
  WORD_ARCHIVES,
  WORD_CATEGORY_SHORT_LABELS,
  type WordCategory
} from "@cosmere/shared";
import { ChevronDown, Folder, FolderOpen } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

export function CategoryTree({
  selected,
  onChange,
  counts = {},
  readonly = false
}: {
  selected: WordCategory[];
  onChange: (next: WordCategory[]) => void;
  counts?: Partial<Record<WordCategory, number>>;
  readonly?: boolean;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({
    cosmere: true,
    cytonic: true,
    qq: true
  });
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const total = selected.reduce((sum, category) => sum + (counts[category] ?? 0), 0);

  function toggleCategory(category: WordCategory) {
    if (readonly) return;
    const next = selectedSet.has(category)
      ? selected.filter((item) => item !== category)
      : [...selected, category];
    onChange(next);
  }

  function setArchive(categories: WordCategory[], enabled: boolean) {
    if (readonly) return;
    const next = new Set(selected);
    for (const category of categories) {
      if (enabled) next.add(category);
      else next.delete(category);
    }
    onChange([...next]);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-white/50">
        <span>已选 {selected.length}/{ALL_WORD_CATEGORIES.length} 个文件</span>
        <span>{total} 条可用词</span>
      </div>
      <div className="space-y-2">
        {WORD_ARCHIVES.map((archive) => {
          const archiveOpen = open[archive.universe] ?? true;
          const checkedCount = archive.categories.filter((category) => selectedSet.has(category)).length;
          const allChecked = checkedCount === archive.categories.length;
          return (
            <div key={archive.universe} className="rounded-md border border-white/10 bg-white/[0.035]">
              <div className="flex items-center gap-2 p-2">
                <button
                  type="button"
                  className="grid size-8 place-items-center rounded hover:bg-white/10"
                  onClick={() => setOpen((current) => ({ ...current, [archive.universe]: !archiveOpen }))}
                >
                  <ChevronDown size={16} className={cn("transition", archiveOpen ? "" : "-rotate-90")} />
                </button>
                {archiveOpen ? <FolderOpen size={18} className="text-brass" /> : <Folder size={18} className="text-brass" />}
                <span className="flex-1 font-semibold">{archive.label}</span>
                {!readonly ? (
                  <Button
                    type="button"
                    className="px-2 py-1 text-xs"
                    onClick={() => setArchive(archive.categories, !allChecked)}
                  >
                    {allChecked ? "全不选" : "全选"}
                  </Button>
                ) : null}
              </div>
              {archiveOpen ? (
                <div className="border-t border-white/8 px-3 pb-3 pt-1">
                  {archive.categories.map((category) => (
                    <label key={category} className="flex cursor-pointer items-center gap-3 rounded px-2 py-2 text-sm hover:bg-white/[0.05]">
                      <input
                        type="checkbox"
                        checked={selectedSet.has(category)}
                        disabled={readonly}
                        onChange={() => toggleCategory(category)}
                      />
                      <span className="flex-1">{WORD_CATEGORY_SHORT_LABELS[category]}</span>
                      <span className="text-xs text-white/42">{counts[category] ?? 0}</span>
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
