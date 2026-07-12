"use client";

import { useState } from "react";
import type { WordArchiveNode } from "@cosmere/shared";
import { DoorOpen, Loader2, Plus } from "lucide-react";
import { CategoryTree } from "./category-tree";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Modal } from "./ui/modal";

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
    <div className="space-y-5">
      {/* 有房间码的玩家直接加入，不需要碰词库 */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/45">朋友给了你房间码？</p>
        <Button onClick={openJoinDialog} className="mt-2 w-full" disabled={pending !== null}>
          <DoorOpen size={18} />
          加入房间
        </Button>
      </div>

      <div className="flex items-center gap-3 text-xs text-white/30">
        <span className="h-px flex-1 bg-white/10" />
        或者自己开一局
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/45">1. 选择题库</p>
        <div className="mt-2">
          <CategoryTree tree={categoryTree} selected={categoryIds} onChange={setCategoryIds} defaultCollapsed />
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/45">2. 创建房间</p>
        <Button
          onClick={createRoom}
          variant="primary"
          className="mt-2 w-full"
          disabled={categoryIds.length === 0 || pending !== null}
        >
          {pending === "create" ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
          {pending === "create" ? "创建中…" : "创建房间"}
        </Button>
        {categoryIds.length === 0 ? (
          <p className="mt-2 text-xs text-white/40">先在上方勾选至少一个词库分类（可以直接点「全选」）。</p>
        ) : null}
      </div>

      {error && !joinOpen ? <p className="text-sm text-ember">{error}</p> : null}

      <Modal open={joinOpen} onClose={() => setJoinOpen(false)} title="加入房间" size="md" showClose>
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
            <Button type="submit" variant="primary" disabled={!joinCode.trim() || pending !== null}>
              {pending === "join" ? <Loader2 size={16} className="animate-spin" /> : null}
              {pending === "join" ? "加入中…" : "确认进入"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
