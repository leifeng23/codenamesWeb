"use client";

import { useState } from "react";
import type { WordArchiveNode } from "@cosmere/shared";
import { DoorOpen, Plus, X } from "lucide-react";
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
  const [error, setError] = useState("");

  async function createRoom() {
    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team: "spectator", categoryIds })
    });
    const room = await response.json();
    if (!response.ok) {
      setError(room.error ?? "创建失败");
      return;
    }
    window.location.href = `/rooms/${room.code}`;
  }

  async function joinRoom() {
    const response = await fetch("/api/rooms/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: joinCode, team: "spectator" })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "加入失败");
      return;
    }
    window.location.href = `/rooms/${data.code}`;
  }

  return (
    <div className="space-y-4">
      <CategoryTree tree={categoryTree} selected={categoryIds} onChange={setCategoryIds} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Button onClick={createRoom} className="w-full bg-storm/18" disabled={categoryIds.length === 0}>
          <Plus size={18} />
          创建房间
        </Button>
        <Button onClick={() => setJoinOpen(true)} className="w-full">
          <DoorOpen size={18} />
          加入房间
        </Button>
      </div>
      {error ? <p className="text-sm text-ember">{error}</p> : null}
      {joinOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-white/15 bg-panel p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-black">加入房间</h3>
              <button className="rounded p-2 hover:bg-white/10" onClick={() => setJoinOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <p className="mt-2 text-sm text-white/55">输入房主分享的 6 位房间码。</p>
            <Input
              className="mt-5 uppercase"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder="输入 6 位房间码"
              autoFocus
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={() => setJoinOpen(false)}>取消</Button>
              <Button onClick={joinRoom} disabled={!joinCode.trim()} className="bg-storm/18">
                确认进入
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
