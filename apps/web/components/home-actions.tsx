"use client";

import { useState } from "react";
import { ALL_WORD_CATEGORIES, type WordCategory } from "@cosmere/shared";
import { DoorOpen, Plus } from "lucide-react";
import { CategoryTree } from "./category-tree";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function HomeActions() {
  const [joinCode, setJoinCode] = useState("");
  const [categories, setCategories] = useState<WordCategory[]>([...ALL_WORD_CATEGORIES]);
  const [error, setError] = useState("");

  async function createRoom() {
    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team: "spectator", categories })
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
      <CategoryTree selected={categories} onChange={setCategories} />
      <Button onClick={createRoom} className="w-full bg-storm/18">
        <Plus size={18} />
        创建邀请码房间
      </Button>
      <div className="flex gap-2">
        <Input value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="输入 6 位房间码" />
        <Button onClick={joinRoom} disabled={!joinCode.trim()}>
          <DoorOpen size={18} />
        </Button>
      </div>
      {error ? <p className="text-sm text-ember">{error}</p> : null}
    </div>
  );
}
