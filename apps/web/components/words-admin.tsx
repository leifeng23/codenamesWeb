"use client";

import {
  WORD_ARCHIVES,
  WORD_CATEGORIES,
  WORD_CATEGORY_LABELS,
  WORD_CATEGORY_SHORT_LABELS,
  type WordCategory,
  type Universe
} from "@cosmere/shared";
import { FileText, FolderOpen, RefreshCcw, Save, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Panel } from "./ui/panel";

interface WordRow {
  id: string;
  universe: Universe;
  category: WordCategory;
  textCn: string;
  textEnOrNote: string;
  enabled: boolean;
  sourceSheet: string | null;
  sourceRow: number | null;
}

export function WordsAdmin({ initialWords }: { initialWords: WordRow[] }) {
  const [words, setWords] = useState(initialWords);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<WordCategory>(WORD_CATEGORIES[0].category);
  const [message, setMessage] = useState("");

  const duplicateKeys = useMemo(() => {
    const seen = new Map<string, number>();
    for (const word of words) {
      const key = `${word.textCn}\u0000${word.textEnOrNote}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return new Set([...seen.entries()].filter(([, count]) => count > 1).map(([key]) => key));
  }, [words]);

  const filtered = words.filter((word) => {
    const haystack = `${word.textCn} ${word.textEnOrNote} ${word.category}`.toLowerCase();
    return word.category === activeCategory && haystack.includes(query.toLowerCase());
  });

  async function patchWord(id: string, data: Partial<WordRow>) {
    const response = await fetch("/api/admin/words", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data })
    });
    const updated = await response.json();
    if (!response.ok) {
      setMessage(updated.error ?? "保存失败");
      return;
    }
    setWords((current) => current.map((word) => (word.id === id ? updated : word)));
    setMessage("已保存");
  }

  async function createWord(formData: FormData) {
    const category = activeCategory;
    const definition = WORD_CATEGORIES.find((item) => item.category === category)!;
    const response = await fetch("/api/admin/words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        universe: definition.universe,
        category,
        textCn: formData.get("textCn"),
        textEnOrNote: formData.get("textEnOrNote"),
        enabled: true
      })
    });
    const created = await response.json();
    if (!response.ok) {
      setMessage(created.error ?? "新增失败");
      return;
    }
    setWords((current) => [created, ...current]);
    setMessage("已新增");
  }

  async function importExcel() {
    const response = await fetch("/api/admin/words/import-excel", { method: "POST" });
    const data = await response.json();
    setMessage(response.ok ? `已导入 ${data.imported} 条` : data.error ?? "导入失败");
    if (response.ok) window.location.reload();
  }

  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-[320px_1fr]">
      <Panel className="self-start">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <FolderOpen size={20} className="text-brass" />
          题库档案
        </h2>
        <div className="mt-5 space-y-3">
          {WORD_ARCHIVES.map((archive) => (
            <div key={archive.universe} className="rounded-md border border-white/10 bg-white/[0.035] p-2">
              <p className="mb-1 px-2 text-sm font-bold text-brass">{archive.label}</p>
              {archive.categories.map((category) => {
                const count = words.filter((word) => word.category === category).length;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm ${
                      activeCategory === category ? "bg-storm/20 text-white" : "text-white/65 hover:bg-white/[0.06]"
                    }`}
                  >
                    <FileText size={15} />
                    <span className="flex-1">{WORD_CATEGORY_SHORT_LABELS[category]}</span>
                    <span className="text-xs text-white/40">{count}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="self-start">
        <h2 className="text-xl font-bold">{WORD_CATEGORY_LABELS[activeCategory]}</h2>
        <form action={createWord} className="mt-5 space-y-3">
          <Input name="textCn" placeholder="中文词条" required />
          <Input name="textEnOrNote" placeholder="英文或备注" required />
          <Button className="w-full">
            <Save size={18} />
            新增词条
          </Button>
        </form>
        <Button onClick={importExcel} className="mt-4 w-full">
          <RefreshCcw size={18} />
          从 Unity Excel 重新导入
        </Button>
        {message ? <p className="mt-4 text-sm text-storm">{message}</p> : null}
        <div className="flex items-center gap-2">
          <Search size={18} className="text-white/45" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索中文、英文、分类" />
        </div>
        <div className="mt-5 max-h-[70vh] overflow-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[780px] border-collapse text-left text-sm">
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
                  <tr key={word.id} className="border-t border-white/8">
                    <td className="p-3">
                      <button
                        onClick={() => patchWord(word.id, { enabled: !word.enabled })}
                        className={word.enabled ? "text-storm" : "text-white/35"}
                      >
                        {word.enabled ? "启用" : "停用"}
                      </button>
                    </td>
                    <td className="p-3 text-white/65">{WORD_CATEGORY_LABELS[word.category]}</td>
                    <td className="p-3 font-semibold">
                      {word.textCn}
                      {duplicate ? <span className="ml-2 rounded bg-brass/20 px-2 py-0.5 text-xs text-brass">重复</span> : null}
                    </td>
                    <td className="p-3 text-white/70">{word.textEnOrNote}</td>
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
