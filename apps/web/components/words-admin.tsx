"use client";

import type { WordArchiveNode } from "@cosmere/shared";
import { Download, FileText, FolderOpen, Plus, Save, Search, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Panel } from "./ui/panel";
import { cn } from "../lib/utils";

interface WordRow {
  id: string;
  wordCategoryId: string;
  textCn: string;
  textEnOrNote: string;
  enabled: boolean;
  sourceSheet: string | null;
  sourceRow: number | null;
  category: {
    id: string;
    name: string;
    archive: { id: string; name: string };
  };
}

function allCategories(archives: WordArchiveNode[]) {
  return archives.flatMap((archive) => archive.categories);
}

export function WordsAdmin({
  initialArchives,
  initialWords
}: {
  initialArchives: WordArchiveNode[];
  initialWords: WordRow[];
}) {
  const [archives, setArchives] = useState(initialArchives);
  const [words, setWords] = useState(initialWords);
  const [activeCategoryId, setActiveCategoryId] = useState(initialArchives[0]?.categories[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [newArchiveName, setNewArchiveName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [importArchiveNames, setImportArchiveNames] = useState<string[]>(() => initialArchives.map((archive) => archive.name));
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => allCategories(archives), [archives]);
  const activeCategory = categories.find((category) => category.id === activeCategoryId) ?? categories[0];
  const duplicateKeys = useMemo(() => {
    const seen = new Map<string, number>();
    for (const word of words) {
      const key = `${word.textCn}\u0000${word.textEnOrNote}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return new Set([...seen.entries()].filter(([, count]) => count > 1).map(([key]) => key));
  }, [words]);
  const filtered = words.filter((word) => {
    const haystack = `${word.textCn} ${word.textEnOrNote} ${word.category.archive.name} ${word.category.name}`.toLowerCase();
    return word.wordCategoryId === activeCategory?.id && haystack.includes(query.toLowerCase());
  });

  async function refreshAdminData(nextArchives?: WordArchiveNode[]) {
    if (nextArchives) {
      setArchives(nextArchives);
      setImportArchiveNames((current) => {
        const names = new Set(nextArchives.map((archive) => archive.name));
        const kept = current.filter((name) => names.has(name));
        for (const archive of nextArchives) {
          if (!kept.includes(archive.name)) kept.push(archive.name);
        }
        return kept;
      });
    }
    const response = await fetch("/api/admin/words");
    const data = await response.json();
    if (response.ok) setWords(data.words);
  }

  async function createArchive(formData: FormData) {
    const name = String(formData.get("archiveName") ?? "").trim();
    if (!name) return;
    const response = await fetch("/api/admin/archives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    const data = await response.json();
    setMessage(response.ok ? "一级档案已创建" : data.error ?? "创建失败");
    if (response.ok) {
      setNewArchiveName("");
      await refreshAdminData(data.archives);
    }
  }

  async function renameArchive(id: string, name: string) {
    const response = await fetch("/api/admin/archives", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name })
    });
    const data = await response.json();
    setMessage(response.ok ? "一级档案已保存" : data.error ?? "保存失败");
    if (response.ok) await refreshAdminData(data.archives);
  }

  async function createCategory(formData: FormData) {
    const archiveId = String(formData.get("archiveId") ?? "");
    const name = String(formData.get("categoryName") ?? "").trim();
    if (!archiveId || !name) return;
    const response = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archiveId, name })
    });
    const data = await response.json();
    setMessage(response.ok ? "二级分类已创建" : data.error ?? "创建失败");
    if (response.ok) {
      setNewCategoryName("");
      await refreshAdminData(data.archives);
    }
  }

  async function renameCategory(id: string, name: string) {
    const response = await fetch("/api/admin/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name })
    });
    const data = await response.json();
    setMessage(response.ok ? "二级分类已保存" : data.error ?? "保存失败");
    if (response.ok) await refreshAdminData(data.archives);
  }

  async function createWord(formData: FormData) {
    if (!activeCategory) return;
    const response = await fetch("/api/admin/words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wordCategoryId: activeCategory.id,
        textCn: formData.get("textCn"),
        textEnOrNote: formData.get("textEnOrNote"),
        enabled: true
      })
    });
    const data = await response.json();
    setMessage(response.ok ? "词条已新增" : data.error ?? "新增失败");
    if (response.ok) {
      setWords((current) => [data, ...current]);
      await refreshAdminData();
    }
  }

  async function patchWord(id: string, data: Partial<Pick<WordRow, "textCn" | "textEnOrNote" | "enabled" | "wordCategoryId">>) {
    const response = await fetch("/api/admin/words", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data })
    });
    const updated = await response.json();
    setMessage(response.ok ? "词条已保存" : updated.error ?? "保存失败");
    if (response.ok) {
      setWords((current) => current.map((word) => (word.id === id ? updated : word)));
      await refreshAdminData();
    }
  }

  async function importExcel(file: File) {
    const formData = new FormData();
    formData.set("file", file);
    for (const archiveName of importArchiveNames) {
      formData.append("archiveNames", archiveName);
    }
    const response = await fetch("/api/admin/words/import-excel", { method: "POST", body: formData });
    const data = await response.json();
    setMessage(response.ok ? `已导入 ${data.imported} 条` : data.error ?? "导入失败");
    if (response.ok) window.location.reload();
  }

  return (
    <div className="mt-8 grid min-w-0 gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
      <Panel className="self-start">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <FolderOpen size={20} className="text-brass" />
          题库档案
        </h2>
        <form action={createArchive} className="mt-5 flex gap-2">
          <Input name="archiveName" value={newArchiveName} onChange={(event) => setNewArchiveName(event.target.value)} placeholder="新一级档案" />
          <Button className="shrink-0 px-3">
            <Plus size={16} />
          </Button>
        </form>
        <form action={createCategory} className="mt-3 grid gap-2">
          <select name="archiveId" className="h-10 rounded-md border border-white/12 bg-black/25 px-3 text-sm">
            {archives.map((archive) => (
              <option key={archive.id} value={archive.id}>
                {archive.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Input name="categoryName" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="新二级分类" />
            <Button className="shrink-0 px-3">
              <Plus size={16} />
            </Button>
          </div>
        </form>
        <div className="mt-5 max-h-[58vh] space-y-3 overflow-auto pr-1">
          {archives.map((archive) => (
            <div key={archive.id} className="rounded-md border border-white/10 bg-white/[0.035] p-2">
              <input
                value={archive.name}
                onChange={(event) =>
                  setArchives((current) => current.map((item) => (item.id === archive.id ? { ...item, name: event.target.value } : item)))
                }
                onBlur={(event) => renameArchive(archive.id, event.target.value)}
                className="mb-1 h-9 w-full rounded bg-transparent px-2 text-sm font-bold text-brass outline-none focus:bg-black/25"
              />
              {archive.categories.map((category) => (
                <div key={category.id} className={cn("group flex items-center gap-2 rounded px-2 py-2", activeCategory?.id === category.id ? "bg-storm/20" : "hover:bg-white/[0.06]")}>
                  <button type="button" onClick={() => setActiveCategoryId(category.id)} className="shrink-0 text-white/65">
                    <FileText size={15} />
                  </button>
                  <input
                    value={category.name}
                    onChange={(event) =>
                      setArchives((current) =>
                        current.map((item) =>
                          item.id === archive.id
                            ? {
                                ...item,
                                categories: item.categories.map((inner) => (inner.id === category.id ? { ...inner, name: event.target.value } : inner))
                              }
                            : item
                        )
                      )
                    }
                    onFocus={() => setActiveCategoryId(category.id)}
                    onBlur={(event) => renameCategory(category.id, event.target.value)}
                    className="min-w-0 flex-1 rounded bg-transparent text-sm outline-none focus:bg-black/25"
                  />
                  <span className="shrink-0 text-xs text-white/40">{category.count}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="min-w-0 self-start">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold">
              {activeCategory ? `${activeCategory.archiveName} / ${activeCategory.name}` : "请选择分类"}
            </h2>
            <p className="mt-1 text-sm text-white/45">新增、编辑、停用词条会立即影响下一局抽词。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => (window.location.href = "/api/admin/words/export-excel")}>
              <Download size={17} />
              导出 Excel
            </Button>
            <Button type="button" onClick={() => fileInputRef.current?.click()}>
              <Upload size={17} />
              导入 Excel
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) importExcel(file);
                event.target.value = "";
              }}
            />
          </div>
        </div>
        <div className="mt-4 rounded-md border border-white/10 bg-white/[0.035] p-3">
          <p className="text-sm font-semibold">Excel 导入替换范围</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {archives.map((archive) => {
              const checked = importArchiveNames.includes(archive.name);
              return (
                <label key={archive.id} className="flex items-center gap-2 rounded border border-white/10 px-2 py-1 text-xs text-white/70">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setImportArchiveNames((current) =>
                        checked ? current.filter((name) => name !== archive.name) : [...current, archive.name]
                      )
                    }
                  />
                  {archive.name}
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-white/42">未勾选的现有档案不会被替换；Excel 里的新 Sheet 会自动创建。</p>
        </div>
        <form action={createWord} className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
          <Input name="textCn" placeholder="中文词条" required disabled={!activeCategory} />
          <Input name="textEnOrNote" placeholder="英文或备注" required disabled={!activeCategory} />
          <Button disabled={!activeCategory}>
            <Save size={18} />
            新增词条
          </Button>
        </form>
        {message ? <p className="mt-4 text-sm text-storm">{message}</p> : null}
        <div className="mt-5 flex items-center gap-2">
          <Search size={18} className="shrink-0 text-white/45" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索中文、英文、分类" />
        </div>
        <div className="mt-5 max-h-[68vh] overflow-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-panel text-white/62">
              <tr>
                <th className="p-3">状态</th>
                <th className="p-3">分类</th>
                <th className="p-3">中文</th>
                <th className="p-3">英文/备注</th>
                <th className="p-3">来源</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((word) => {
                const duplicate = duplicateKeys.has(`${word.textCn}\u0000${word.textEnOrNote}`);
                return (
                  <tr key={word.id} className="border-t border-white/8 align-top">
                    <td className="p-3">
                      <button
                        onClick={() => patchWord(word.id, { enabled: !word.enabled })}
                        className={word.enabled ? "text-storm" : "text-white/35"}
                      >
                        {word.enabled ? "启用" : "停用"}
                      </button>
                    </td>
                    <td className="p-3">
                      <select
                        value={word.wordCategoryId}
                        onChange={(event) => patchWord(word.id, { wordCategoryId: event.target.value })}
                        className="w-48 rounded-md border border-white/12 bg-black/25 px-2 py-2"
                      >
                        {archives.map((archive) => (
                          <optgroup key={archive.id} label={archive.name}>
                            {archive.categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <Input
                        defaultValue={word.textCn}
                        onBlur={(event) => {
                          if (event.target.value !== word.textCn) patchWord(word.id, { textCn: event.target.value });
                        }}
                      />
                      {duplicate ? <span className="mt-1 inline-block rounded bg-brass/20 px-2 py-0.5 text-xs text-brass">重复</span> : null}
                    </td>
                    <td className="p-3">
                      <Input
                        defaultValue={word.textEnOrNote}
                        onBlur={(event) => {
                          if (event.target.value !== word.textEnOrNote) patchWord(word.id, { textEnOrNote: event.target.value });
                        }}
                      />
                    </td>
                    <td className="p-3 text-white/38">
                      {word.sourceSheet ? `${word.sourceSheet}:${word.sourceRow}` : "后台新增"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
