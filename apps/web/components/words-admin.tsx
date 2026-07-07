"use client";

import type { WordArchiveNode } from "@cosmere/shared";
import {
  ChevronDown,
  Download,
  FileText,
  FolderOpen,
  Plus,
  Save,
  Search,
  Trash2,
  Upload
} from "lucide-react";
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

interface ConfirmState {
  title: string;
  body: string;
  confirmLabel: string;
  run: () => void | Promise<void>;
}

function allCategories(archives: WordArchiveNode[]) {
  return archives.flatMap((archive) => archive.categories);
}

export function WordsAdmin({
  initialArchives,
  initialWords,
  isTopAdmin
}: {
  initialArchives: WordArchiveNode[];
  initialWords: WordRow[];
  isTopAdmin: boolean;
}) {
  const [archives, setArchives] = useState(initialArchives);
  const [words, setWords] = useState(initialWords);
  const [activeCategoryId, setActiveCategoryId] = useState(initialArchives[0]?.categories[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [newArchiveName, setNewArchiveName] = useState("");
  const [newCategoryArchiveId, setNewCategoryArchiveId] = useState(initialArchives[0]?.id ?? "");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newWordCn, setNewWordCn] = useState("");
  const [newWordNote, setNewWordNote] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importArchiveNames, setImportArchiveNames] = useState<string[]>(() => initialArchives.map((a) => a.name));
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
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
    const haystack = `${word.textCn} ${word.textEnOrNote}`.toLowerCase();
    return word.wordCategoryId === activeCategory?.id && haystack.includes(query.toLowerCase());
  });

  function notify(ok: boolean, text: string) {
    setMessage({ tone: ok ? "ok" : "err", text });
  }

  async function refreshWords() {
    const response = await fetch("/api/admin/words");
    const data = await response.json();
    if (response.ok) setWords(data.words);
  }

  async function refreshArchives() {
    const response = await fetch("/api/admin/categories");
    const data = await response.json();
    if (response.ok) setArchives(data.archives);
  }

  function ensureActiveValid(nextArchives: WordArchiveNode[]) {
    const stillExists = nextArchives.some((a) => a.categories.some((c) => c.id === activeCategoryId));
    if (!stillExists) setActiveCategoryId(nextArchives[0]?.categories[0]?.id ?? "");
  }

  // ---------- 一级仓库 ----------
  async function createArchive() {
    const name = newArchiveName.trim();
    if (!name) return;
    const response = await fetch("/api/admin/archives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    const data = await response.json();
    notify(response.ok, response.ok ? `已创建仓库「${name}」` : data.error ?? "创建失败");
    if (response.ok) {
      setNewArchiveName("");
      setArchives(data.archives);
    }
  }

  async function renameArchive(id: string, name: string) {
    const response = await fetch("/api/admin/archives", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name })
    });
    const data = await response.json();
    notify(response.ok, response.ok ? "仓库已保存" : data.error ?? "保存失败");
    if (response.ok) setArchives(data.archives);
  }

  function askDeleteArchive(archive: WordArchiveNode) {
    const total = archive.categories.reduce((sum, c) => sum + c.count, 0);
    setConfirm({
      title: `删除仓库「${archive.name}」`,
      body: `将永久删除该仓库下的 ${archive.categories.length} 个分类与约 ${total} 条词条，无法恢复。`,
      confirmLabel: "删除仓库",
      run: async () => {
        const response = await fetch("/api/admin/archives", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: archive.id })
        });
        const data = await response.json();
        notify(response.ok, response.ok ? "仓库已删除" : data.error ?? "删除失败");
        if (response.ok) {
          setArchives(data.archives);
          ensureActiveValid(data.archives);
          await refreshWords();
        }
      }
    });
  }

  // ---------- 二级分类 ----------
  async function createCategory() {
    const archiveId = newCategoryArchiveId || archives[0]?.id;
    const name = newCategoryName.trim();
    if (!archiveId || !name) return;
    const response = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archiveId, name })
    });
    const data = await response.json();
    notify(response.ok, response.ok ? `已创建分类「${name}」` : data.error ?? "创建失败");
    if (response.ok) {
      setNewCategoryName("");
      setArchives(data.archives);
    }
  }

  async function renameCategory(id: string, name: string) {
    const response = await fetch("/api/admin/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name })
    });
    const data = await response.json();
    notify(response.ok, response.ok ? "分类已保存" : data.error ?? "保存失败");
    if (response.ok) setArchives(data.archives);
  }

  function askDeleteCategory(archiveName: string, category: { id: string; name: string; count: number }) {
    setConfirm({
      title: `删除分类「${category.name}」`,
      body: `属于「${archiveName}」，将永久删除该分类下的 ${category.count} 条词条，无法恢复。`,
      confirmLabel: "删除分类",
      run: async () => {
        const response = await fetch("/api/admin/categories", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: category.id })
        });
        const data = await response.json();
        notify(response.ok, response.ok ? "分类已删除" : data.error ?? "删除失败");
        if (response.ok) {
          setArchives(data.archives);
          ensureActiveValid(data.archives);
          await refreshWords();
        }
      }
    });
  }

  // ---------- 词条 ----------
  async function createWord() {
    if (!activeCategory) return;
    const textCn = newWordCn.trim();
    if (!textCn) return;
    const response = await fetch("/api/admin/words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wordCategoryId: activeCategory.id,
        textCn,
        textEnOrNote: newWordNote.trim(),
        enabled: true
      })
    });
    const data = await response.json();
    notify(response.ok, response.ok ? "词条已新增" : data.error ?? "新增失败");
    if (response.ok) {
      setWords((current) => [data, ...current]);
      setNewWordCn("");
      setNewWordNote("");
      await refreshArchives();
    }
  }

  async function patchWord(id: string, patch: Partial<Pick<WordRow, "textCn" | "textEnOrNote" | "enabled" | "wordCategoryId">>) {
    const response = await fetch("/api/admin/words", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch })
    });
    const updated = await response.json();
    notify(response.ok, response.ok ? "词条已保存" : updated.error ?? "保存失败");
    if (response.ok) {
      setWords((current) => current.map((word) => (word.id === id ? updated : word)));
      if (patch.wordCategoryId) await refreshArchives();
    }
  }

  function askDeleteWord(word: WordRow) {
    setConfirm({
      title: "删除词条",
      body: `确认永久删除「${word.textCn}」？如该词条曾用于对局，请改为「停用」。`,
      confirmLabel: "删除词条",
      run: async () => {
        const response = await fetch("/api/admin/words", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: word.id })
        });
        const data = await response.json();
        notify(response.ok, response.ok ? "词条已删除" : data.error ?? "删除失败");
        if (response.ok) {
          setWords((current) => current.filter((item) => item.id !== word.id));
          await refreshArchives();
        }
      }
    });
  }

  async function importExcel(file: File) {
    const formData = new FormData();
    formData.set("file", file);
    for (const archiveName of importArchiveNames) formData.append("archiveNames", archiveName);
    const response = await fetch("/api/admin/words/import-excel", { method: "POST", body: formData });
    const data = await response.json();
    notify(response.ok, response.ok ? `已导入 ${data.imported} 条` : data.error ?? "导入失败");
    if (response.ok) window.location.reload();
  }

  return (
    <div className="mt-8 grid min-w-0 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      {/* ===== 左：题库结构 ===== */}
      <Panel className="self-start">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <FolderOpen size={20} className="text-brass" />
          题库结构
        </h2>

        {/* 新建 */}
        <div className="mt-4 space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
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
            <div key={archive.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
              <div className="mb-1 flex items-center gap-1">
                {isTopAdmin ? (
                  <input
                    value={archive.name}
                    onChange={(event) =>
                      setArchives((current) => current.map((item) => (item.id === archive.id ? { ...item, name: event.target.value } : item)))
                    }
                    onBlur={(event) => event.target.value.trim() && renameArchive(archive.id, event.target.value.trim())}
                    className="h-9 min-w-0 flex-1 rounded bg-transparent px-2 text-sm font-bold text-brass outline-none focus:bg-black/25"
                  />
                ) : (
                  <span className="h-9 min-w-0 flex-1 truncate px-2 py-1.5 text-sm font-bold text-brass">{archive.name}</span>
                )}
                {isTopAdmin ? (
                  <button
                    type="button"
                    onClick={() => askDeleteArchive(archive)}
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
                const active = activeCategory?.id === category.id;
                return (
                  <div
                    key={category.id}
                    className={cn(
                      "group flex items-center gap-1 rounded px-1.5 py-1.5 transition",
                      active ? "bg-storm/20" : "hover:bg-white/[0.06]"
                    )}
                  >
                    <button type="button" onClick={() => setActiveCategoryId(category.id)} className="shrink-0 text-white/55">
                      <FileText size={15} />
                    </button>
                    <input
                      value={category.name}
                      onChange={(event) =>
                        setArchives((current) =>
                          current.map((item) =>
                            item.id === archive.id
                              ? { ...item, categories: item.categories.map((inner) => (inner.id === category.id ? { ...inner, name: event.target.value } : inner)) }
                              : item
                          )
                        )
                      }
                      onFocus={() => setActiveCategoryId(category.id)}
                      onBlur={(event) => event.target.value.trim() && renameCategory(category.id, event.target.value.trim())}
                      className="min-w-0 flex-1 rounded bg-transparent px-1 text-sm outline-none focus:bg-black/25"
                    />
                    <span className="shrink-0 rounded bg-white/5 px-1.5 text-xs text-white/45">{category.count}</span>
                    <button
                      type="button"
                      onClick={() => askDeleteCategory(archive.name, category)}
                      title="删除分类"
                      className="shrink-0 rounded p-1 text-white/30 opacity-0 transition group-hover:opacity-100 hover:bg-ember/15 hover:text-ember"
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

      {/* ===== 右：词条 ===== */}
      <Panel className="min-w-0 self-start">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold">
              {activeCategory ? `${activeCategory.archiveName} / ${activeCategory.name}` : "请选择分类"}
            </h2>
            <p className="mt-1 text-sm text-white/45">
              {activeCategory ? `共 ${activeCategory.count} 条 · 改动立即影响下一局抽词` : "在左侧选择一个二级分类后管理词条"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => (window.location.href = "/api/admin/words/export-excel")}>
              <Download size={17} />
              导出
            </Button>
            <Button type="button" onClick={() => fileInputRef.current?.click()}>
              <Upload size={17} />
              导入
            </Button>
            <button
              type="button"
              onClick={() => setImportOpen((v) => !v)}
              className="rounded-md border border-white/12 px-2 text-xs text-white/55 hover:bg-white/5"
              title="导入设置"
            >
              <ChevronDown size={16} className={cn("transition", importOpen ? "" : "-rotate-90")} />
            </button>
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

        {/* 导入设置（折叠） */}
        {importOpen ? (
          <div className="mt-3 rounded-md border border-white/10 bg-white/[0.03] p-3">
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
        ) : null}

        {/* 新增词条 */}
        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
          <Input
            value={newWordCn}
            onChange={(event) => setNewWordCn(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && createWord()}
            placeholder="中文词条（必填）"
            disabled={!activeCategory}
          />
          <Input
            value={newWordNote}
            onChange={(event) => setNewWordNote(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && createWord()}
            placeholder="英文 / 备注（可选）"
            disabled={!activeCategory}
          />
          <Button onClick={createWord} disabled={!activeCategory || !newWordCn.trim()}>
            <Save size={18} />
            新增词条
          </Button>
        </div>

        {message ? (
          <p className={cn("mt-4 text-sm", message.tone === "ok" ? "text-storm" : "text-ember")}>{message.text}</p>
        ) : null}

        {/* 搜索 */}
        <div className="mt-5 flex items-center gap-2">
          <Search size={18} className="shrink-0 text-white/45" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="在当前分类内搜索中文 / 英文" />
        </div>

        {/* 词条表 */}
        <div className="nice-scroll mt-4 max-h-[64vh] overflow-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-panel text-white/62">
              <tr>
                <th className="w-20 p-3">状态</th>
                <th className="p-3">中文</th>
                <th className="p-3">英文 / 备注</th>
                <th className="w-44 p-3">分类</th>
                <th className="w-16 p-3 text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sm text-white/35">
                    {activeCategory ? "该分类暂无词条，使用上方表单新增。" : "请先在左侧选择分类。"}
                  </td>
                </tr>
              ) : null}
              {filtered.map((word) => {
                const duplicate = duplicateKeys.has(`${word.textCn}\u0000${word.textEnOrNote}`);
                return (
                  <tr key={word.id} className="border-t border-white/8 align-top hover:bg-white/[0.02]">
                    <td className="p-3">
                      <button
                        onClick={() => patchWord(word.id, { enabled: !word.enabled })}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-semibold transition",
                          word.enabled ? "bg-storm/20 text-storm" : "bg-white/5 text-white/40"
                        )}
                      >
                        {word.enabled ? "启用" : "停用"}
                      </button>
                    </td>
                    <td className="p-3">
                      <Input
                        defaultValue={word.textCn}
                        onBlur={(event) => {
                          if (event.target.value.trim() && event.target.value !== word.textCn)
                            patchWord(word.id, { textCn: event.target.value.trim() });
                        }}
                      />
                      {duplicate ? <span className="mt-1 inline-block rounded bg-brass/20 px-2 py-0.5 text-xs text-brass">重复</span> : null}
                    </td>
                    <td className="p-3">
                      <Input
                        defaultValue={word.textEnOrNote}
                        onBlur={(event) => {
                          if (event.target.value !== word.textEnOrNote) patchWord(word.id, { textEnOrNote: event.target.value.trim() });
                        }}
                      />
                    </td>
                    <td className="p-3">
                      <select
                        value={word.wordCategoryId}
                        onChange={(event) => patchWord(word.id, { wordCategoryId: event.target.value })}
                        className="w-full rounded-md border border-white/12 bg-black/25 px-2 py-2"
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
                    <td className="p-3 text-center">
                      <button
                        onClick={() => askDeleteWord(word)}
                        title="删除词条"
                        className="rounded p-1.5 text-white/35 transition hover:bg-ember/15 hover:text-ember"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* 删除确认 */}
      {confirm ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-ember/30 bg-panel p-6 shadow-2xl">
            <h3 className="flex items-center gap-2 text-lg font-black text-ember">
              <Trash2 size={18} /> {confirm.title}
            </h3>
            <p className="mt-2 text-sm text-white/60">{confirm.body}</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={() => setConfirm(null)}>取消</Button>
              <Button
                className="bg-ember/30 text-ember"
                onClick={async () => {
                  const action = confirm.run;
                  setConfirm(null);
                  await action();
                }}
              >
                {confirm.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
