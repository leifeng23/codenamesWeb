"use client";

import { ArrowLeft, Check, Copy, Crown, Settings, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

export function RoomHeader({
  roomCode,
  connected,
  hasGame,
  isOwner,
  soundEnabled,
  onToggleSound,
  onStartGame,
  onOpenSettings,
  onCopyError
}: {
  roomCode: string;
  connected: boolean;
  hasGame: boolean;
  isOwner: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onStartGame: () => void;
  onOpenSettings: () => void;
  onCopyError: () => void;
}) {
  const [codeCopied, setCodeCopied] = useState(false);

  async function copyRoomCode() {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1600);
    } catch {
      onCopyError();
    }
  }

  return (
    <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-storm/70">
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded text-storm/70 transition hover:text-storm"
          >
            <ArrowLeft size={13} />
            大厅
          </Link>
          <span className="text-white/20">·</span>
          <span
            className={cn(
              "inline-block size-2 rounded-full transition",
              connected
                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
                : "animate-pulse bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]"
            )}
          />
          {connected ? "实时连接" : "连接中…"}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="break-words text-3xl font-black md:text-4xl">房间 {roomCode}</h1>
          <button
            onClick={copyRoomCode}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/12 bg-white/[0.06] px-2.5 py-1.5 text-xs text-white/70 transition hover:bg-white/12 active:scale-95"
            aria-label="复制房间码"
          >
            {codeCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            {codeCopied ? "已复制" : "复制房间码"}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onToggleSound} aria-label="切换音效">
          {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </Button>
        {isOwner ? (
          <Button onClick={onOpenSettings} aria-label="房间设置">
            <Settings size={18} />
          </Button>
        ) : null}
        {isOwner ? (
          <Button variant="primary" onClick={onStartGame} disabled={!connected}>
            <Crown size={18} />
            {hasGame ? "重开一局" : "开始游戏"}
          </Button>
        ) : null}
      </div>
    </header>
  );
}
