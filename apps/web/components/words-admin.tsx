"use client";

import type { WordArchiveNode } from "@cosmere/shared";
import { Download, Save, Search, Trash2, Upload, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { ArchiveTree } from "./admin/archive-tree";
import { ImportDialog } from "./admin/import-dialog";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { Input } from "./ui/input";
import { Panel } from "./ui/panel";
import { Spinner } from "./ui/spinner";
import { useToast } from "./ui/toast";
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

// 当前全量词条在客户端过滤已足够；如词库超过约 1 万条，再考虑服务端分页。
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkMoveTarget, setBulkMoveTarget] = useState("");
  const [creating, setCreating] = useState(false);
  const [newWordCn, setNewWordCn] = useState("");
  const [newWordNote, setNewWordNote] = useState("");
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

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

  // 搜索为空 → 浏览当前分类；有关键词 → 全局跨分类搜索
  const globalSearch = query.trim().length > 0;
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return words.filter((word) => {
      if (!globalSearch) return word.wordCategoryId === activeCategory?.id;
      return `${word.textCn} ${word.textEnOrNote}`.toLowerCase().includes(keyword);
    });
  }, [words, query, globalSearch, activeCategory?.id]);

  const filteredIds = useMemo(() => filtered.map((word) => word.id), [filtered]);
  const allFilteredSelected = filtered.length > 0 && filtered.every((word) => selectedIds.has(word.id));

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
  async function createArchive(name: string) {
    const response = await fetch("/api/admin/archives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    const data = await response.json();
    if (!response.ok) {
      toast.err(data.error ?? "创建失败");
      return false;
    }
    toast.ok(`已创建仓库「${name}」`);
    setArchives(data.archives);
    return true;
  }

  async function renameArchive(id: string, name: string) {
    const response = await fetch("/api/admin/archives", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name })
    });
    const data = await response.json();
    if (!response.ok) {
      toast.err(data.error ?? "保存失败");
      return;
    }
    setArchives(data.archives);
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
        if (!response.ok) {
          toast.err(data.error ?? "删除失败");
          return;
        }
        toast.ok("仓库已删除");
        setArchives(data.archives);
        ensureActiveValid(data.archives);
        await refreshWords();
      }
    });
  }

  // ---------- 二级分类 ----------
  async function createCategory(archiveId: string, name: string) {
    const response = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archiveId, name })
    });
    const data = await response.json();
    if (!response.ok) {
      toast.err(data.error ?? "创建失败");
      return false;
    }
    toast.ok(`已创建分类「${name}」`);
    setArchives(data.archives);
    return true;
  }

  async function renameCategory(id: string, name: string) {
    const response = await fetch("/api/admin/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name })
    });
    const data = await response.json();
    if (!response.ok) {
      toast.err(data.error ?? "保存失败");
      return;
    }
    setArchives(data.archives);
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
        if (!response.ok) {
          toast.err(data.error ?? "删除失败");
          return;
        }
        toast.ok("分类已删除");
        setArchives(data.archives);
        ensureActiveValid(data.archives);
        await refreshWords();
      }
    });
  }

  // ---------- 词条 ----------
  async function createWord() {
    if (!activeCategory || creating) return;
    const textCn = newWordCn.trim();
    if (!textCn) return;
    setCreating(true);
    try {
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
      if (!response.ok) {
        toast.err(data.error ?? "新增失败");
        return;
      }
      toast.ok(`已新增「${textCn}」`);
      setWords((current) => [data, ...current]);
      setNewWordCn("");
      setNewWordNote("");
      await refreshArchives();
    } finally {
      setCreating(false);
    }
  }

  async function patchWord(
    id: string,
    patch: Partial<Pick<WordRow, "textCn" | "textEnOrNote" | "enabled" | "wordCategoryId">>,
    options: { silent?: boolean } = {}
  ) {
    const response = await fetch("/api/admin/words", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch })
    });
    const updated = await response.json();
    if (!response.ok) {
      toast.err(updated.error ?? "保存失败");
      return false;
    }
    if (!options.silent) toast.ok("词条已保存");
    setWords((current) => current.map((word) => (word.id === id ? updated : word)));
    if (patch.wordCategoryId) await refreshArchives();
    return true;
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
        if (!response.ok) {
          toast.err(data.error ?? "删除失败");
          return;
        }
        toast.ok("词条已删除");
        setWords((current) => current.filter((item) => item.id !== word.id));
        setSelectedIds((current) => {
          const next = new Set(current);
          next.delete(word.id);
          return next;
        });
        await refreshArchives();
      }
    });
  }

  // ---------- 批量操作 ----------
  function toggleSelectAll() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) {
        for (const id of filteredIds) next.delete(id);
      } else {
        for (const id of filteredIds) next.add(id);
      }
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkPatch(patch: { enabled?: boolean; wordCategoryId?: string }) {
    if (bulkPending || selectedIds.size === 0) return;
    setBulkPending(true);
    try {
      const ids = [...selectedIds];
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const response = await fetch("/api/admin/words", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, ...patch })
          });
          if (!response.ok) throw new Error();
          return response.json();
        })
      );
      const updatedById = new Map<string, WordRow>();
      let failed = 0;
      results.forEach((result, index) => {
        if (result.status === "fulfilled") updatedById.set(ids[index], result.value as WordRow);
        else failed += 1;
      });
      setWords((current) => current.map((word) => updatedById.get(word.id) ?? word));
      if (failed > 0) toast.err(`成功 ${updatedById.size} 条，失败 ${failed} 条`);
      else toast.ok(`已更新 ${updatedById.size} 条词条`);
      if (patch.wordCategoryId) await refreshArchives();
      setSelectedIds(new Set());
    } finally {
      setBulkPending(false);
      setBulkMoveTarget("");
    }
  }

  function askBulkDelete() {
    const count = selectedIds.size;
    setConfirm({
      title: `批量删除 ${count} 条词条`,
      body: "将永久删除所选词条，无法恢复。曾用于对局的词条会删除失败，请改为「停用」。",
      confirmLabel: `删除 ${count} 条`,
      run: async () => {
        setBulkPending(true);
        try {
          const ids = [...selectedIds];
          const results = await Promise.allSettled(
            ids.map(async (id) => {
              const response = await fetch("/api/admin/words", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id })
              });
              if (!response.ok) throw new Error();
              return id;
            })
          );
          const deleted = new Set(
            results.filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled").map((r) => r.value)
          );
          const failed = ids.length - deleted.size;
          setWords((current) => current.filter((word) => !deleted.has(word.id)));
          setSelectedIds(new Set());
          if (failed > 0) toast.err(`已删除 ${deleted.size} 条，${failed} 条删除失败（可能曾用于对局）`);
          else toast.ok(`已删除 ${deleted.size} 条词条`);
          await refreshArchives();
        } finally {
          setBulkPending(false);
        }
      }
    });
  }

  // ---------- Excel 导入 ----------
  async function importExcel(archiveNames: string[]) {
    if (!pendingImportFile || importing) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.set("file", pendingImportFile);
      for (const archiveName of archiveNames) formData.append("archiveNames", archiveName);
      const response = await fetch("/api/admin/words/import-excel", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) {
        toast.err(data.error ?? "导入失败");
        return;
      }
      toast.ok(`已导入 ${data.imported} 条词条`);
      setPendingImportFile(null);
      setSelectedIds(new Set());
      // 导入可能删除了当前选中的分类，刷新后校正选中项
      const [, categoriesResponse] = await Promise.all([refreshWords(), fetch("/api/admin/categories")]);
      const freshArchives = await categoriesResponse.json();
      if (categoriesResponse.ok && freshArchives.archives) {
        setArchives(freshArchives.archives);
        ensureActiveValid(freshArchives.archives);
      }
    } catch {
      toast.err("网络异常，导入未完成");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mt-6 grid min-w-0 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      {/* ===== 左：题库结构 ===== */}
      <ArchiveTree
        archives={archives}
        isTopAdmin={isTopAdmin}
        activeCategoryId={activeCategory?.id ?? ""}
        onSelectCategory={(id) => {
          setActiveCategoryId(id);
          setQuery("");
        }}
        onCreateArchive={createArchive}
        onRenameArchive={renameArchive}
        onDeleteArchive={askDeleteArchive}
        onCreateCategory={createCategory}
        onRenameCategory={renameCategory}
        onDeleteCategory={askDeleteCategory}
        onLocalRename={setArchives}
      />

      {/* ===== 右：词条 ===== */}
      <Panel className="min-w-0 self-start">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold">
              {globalSearch
                ? `全局搜索：命中 ${filtered.length} 条`
                : activeCategory
                  ? `${activeCategory.archiveName} / ${activeCategory.name}`
                  : "请选择分类"}
            </h2>
            <p className="mt-1 text-sm text-white/45">
              {globalSearch
                ? "正在跨全部仓库搜索，点击词条的分类标签可跳转定位"
                : activeCategory
                  ? `共 ${activeCategory.count} 条 · 改动立即影响下一局抽词`
                  : "在左侧选择一个二级分类后管理词条"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => (window.location.href = "/api/admin/words/export-excel")}>
              <Download size={17} />
              导出
            </Button>
            <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              {importing ? <Spinner size={17} /> : <Upload size={17} />}
              导入
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) setPendingImportFile(file);
                event.target.value = "";
              }}
            />
          </div>
        </div>

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
          <Button onClick={createWord} disabled={!activeCategory || !newWordCn.trim() || creating}>
            {creating ? <Spinner size={18} /> : <Save size={18} />}
            新增词条
          </Button>
        </div>

        {/* 搜索 */}
        <div className="mt-5 flex items-center gap-2">
          <Search size={18} className="shrink-0 text-white/45" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="全局搜索中文 / 英文（留空则浏览当前分类）"
          />
          {globalSearch ? (
            <Button type="button" className="shrink-0 px-3" onClick={() => setQuery("")} aria-label="清除搜索">
              <X size={16} />
            </Button>
          ) : null}
        </div>

        {/* 批量操作条 */}
        {selectedIds.size > 0 ? (
          <div className="sticky top-0 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-storm/30 bg-[#0d1b24]/95 px-3 py-2 backdrop-blur">
            <span className="text-sm font-semibold text-storm">已选 {selectedIds.size} 条</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button size="sm" onClick={() => bulkPatch({ enabled: true })} disabled={bulkPending}>
                启用
              </Button>
              <Button size="sm" onClick={() => bulkPatch({ enabled: false })} disabled={bulkPending}>
                停用
              </Button>
              <select
                value={bulkMoveTarget}
                onChange={(event) => {
                  const target = event.target.value;
                  setBulkMoveTarget(target);
                  if (target) void bulkPatch({ wordCategoryId: target });
                }}
                disabled={bulkPending}
                className="h-8 rounded-md border border-white/12 bg-black/25 px-2 text-xs"
                aria-label="移动到分类"
              >
                <option value="">移动到…</option>
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
              <Button size="sm" variant="danger" onClick={askBulkDelete} disabled={bulkPending}>
                <Trash2 size={13} />
                删除
              </Button>
              {bulkPending ? <Spinner size={15} className="text-storm" /> : null}
            </div>
            <button
              className="ml-auto rounded p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
              onClick={() => setSelectedIds(new Set())}
              aria-label="取消选择"
            >
              <X size={15} />
            </button>
          </div>
        ) : null}

        {/* 词条表 */}
        <div className="nice-scroll mt-4 max-h-[64vh] overflow-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-panel text-white/62">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    disabled={filtered.length === 0}
                    aria-label="全选当前列表"
                  />
                </th>
                <th className="w-20 px-3 py-2.5">状态</th>
                <th className="px-3 py-2.5">中文</th>
                <th className="px-3 py-2.5">英文 / 备注</th>
                <th className="w-44 px-3 py-2.5">分类</th>
                <th className="w-16 px-3 py-2.5 text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-sm text-white/35">
                    {globalSearch
                      ? "没有匹配的词条。"
                      : activeCategory
                        ? "该分类暂无词条，使用上方表单新增。"
                        : "请先在左侧选择分类。"}
                  </td>
                </tr>
              ) : null}
              {filtered.map((word) => {
                const duplicate = duplicateKeys.has(`${word.textCn}\u0000${word.textEnOrNote}`);
                return (
                  <tr key={word.id} className="border-t border-white/8 align-top hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(word.id)}
                        onChange={() => toggleSelect(word.id)}
                        aria-label={`选择「${word.textCn}」`}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => patchWord(word.id, { enabled: !word.enabled }, { silent: true })}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-semibold transition",
                          word.enabled ? "bg-storm/20 text-storm" : "bg-white/5 text-white/40"
                        )}
                      >
                        {word.enabled ? "启用" : "停用"}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <Input
                        defaultValue={word.textCn}
                        onBlur={(event) => {
                          if (event.target.value.trim() && event.target.value !== word.textCn)
                            patchWord(word.id, { textCn: event.target.value.trim() });
                        }}
                      />
                      {duplicate ? (
                        <Badge tone="brass" className="mt-1">
                          重复
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">
                      <Input
                        defaultValue={word.textEnOrNote}
                        onBlur={(event) => {
                          if (event.target.value !== word.textEnOrNote)
                            patchWord(word.id, { textEnOrNote: event.target.value.trim() });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      {globalSearch ? (
                        <button
                          onClick={() => {
                            setActiveCategoryId(word.wordCategoryId);
                            setQuery("");
                          }}
                          className="rounded-md border border-white/12 bg-white/[0.04] px-2 py-1.5 text-xs text-white/70 transition hover:bg-storm/15 hover:text-storm"
                          title="跳转到该分类"
                        >
                          {word.category.archive.name} / {word.category.name}
                        </button>
                      ) : (
                        <select
                          value={word.wordCategoryId}
                          onChange={(event) => patchWord(word.id, { wordCategoryId: event.target.value })}
                          className="w-full rounded-md border border-white/12 bg-black/25 px-2 py-2"
                          aria-label="移动到分类"
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
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
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

      {/* 导入确认 */}
      <ImportDialog
        file={pendingImportFile}
        archives={archives}
        pending={importing}
        onConfirm={importExcel}
        onCancel={() => setPendingImportFile(null)}
      />

      {/* 删除确认 */}
      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title ?? ""}
        body={confirm?.body}
        confirmLabel={confirm?.confirmLabel ?? "确认"}
        tone="danger"
        pending={confirmPending}
        onCancel={() => {
          if (!confirmPending) setConfirm(null);
        }}
        onConfirm={async () => {
          if (!confirm) return;
          setConfirmPending(true);
          try {
            await confirm.run();
          } finally {
            setConfirmPending(false);
            setConfirm(null);
          }
        }}
      />
    </div>
  );
}
