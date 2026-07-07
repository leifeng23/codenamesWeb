"use client";

import { useEffect, useState } from "react";
import type { WordArchiveNode } from "@cosmere/shared";
import { DoorOpen, Loader2, Plus, X } from "lucide-react";
import { CategoryTree } from "./category-tree";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function HomeActions({
  categoryTree
}: {
  categoryTree: WordArchiveNode[];
}) {
  const [joinCode, setJoinCode] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [joinOpen, setJoinOpen] = useState(false);
  const [pending, setPending] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState("");

  // 弹窗打开时支持 Esc 关闭
  useEffect(() => {
    if (!joinOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setJoinOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [joinOpen]);

  async function createRoom() {
    if (pending) return;
    setPending("create");
    setError("");
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team: "spectator", categoryIds })
      });
      const room = await response.json();
      if (!response.ok) {
        setError(room.error ?? "创建失败");
        setPending(null);
        return;
      }
      window.location.href = `/rooms/${room.code}`;
    } catch {
      setError("网络异常，请稍后重试");
      setPending(null);
    }
  }

  async function joinRoom() {
    if (pending || !joinCode.trim()) return;
    setPending("join");
    setError("");
    try {
      const response = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode, team: "spectator" })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "加入失败");
        setPending(null);
        return;
      }
      window.location.href = `/rooms/${data.code}`;
    } catch {
      setError("网络异常，请稍后重试");
      setPending(null);
    }
  }

  function openJoinDialog() {
    setError("");
    setJoinOpen(true);
  }

  return (
    <div className="space-y-4">
      <CategoryTree tree={categoryTree} selected={categoryIds} onChange={setCategoryIds} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          onClick={createRoom}
          className="w-full bg-storm/18"
          disabled={categoryIds.length === 0 || pending !== null}
        >
          {pending === "create" ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
          {pending === "create" ? "创建中…" : "创建房间"}
        </Button>
        <Button onClick={openJoinDialog} className="w-full" disabled={pending !== null}>
          <DoorOpen size={18} />
          加入房间
        </Button>
      </div>
      {categoryIds.length === 0 ? (
        <p className="text-xs text-white/40">先在上方勾选至少一个词库分类，才能创建房间。</p>
      ) : null}
      {error && !joinOpen ? <p className="text-sm text-ember">{error}</p> : null}
      {joinOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) setJoinOpen(false);
          }}
        >
          <div className="result-pop w-full max-w-md rounded-lg border border-white/15 bg-panel p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-black">加入房间</h3>
              <button
                className="rounded p-2 transition hover:bg-white/10"
                onClick={() => setJoinOpen(false)}
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-2 text-sm text-white/55">输入房主分享的 6 位房间码。</p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void joinRoom();
              }}
            >
              <Input
                className="mt-5 text-center text-lg font-bold uppercase tracking-[0.4em]"
                value={joinCode}
                maxLength={6}
                autoComplete="off"
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                placeholder="ABC123"
                autoFocus
              />
              {error ? <p className="mt-3 text-sm text-ember">{error}</p> : null}
              <div className="mt-5 flex justify-end gap-2">
                <Button type="button" onClick={() => setJoinOpen(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={!joinCode.trim() || pending !== null} className="bg-storm/18">
                  {pending === "join" ? <Loader2 size={16} className="animate-spin" /> : null}
                  {pending === "join" ? "加入中…" : "确认进入"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
