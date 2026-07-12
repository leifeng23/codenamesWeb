"use client";

import type { TeamChatMessage } from "@cosmere/shared";
import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { formatEventTime } from "./labels";

export function TeamChat({
  messages,
  canChat,
  hint,
  onSend
}: {
  messages: TeamChatMessage[];
  canChat: boolean;
  hint: string;
  onSend: (text: string) => void;
}) {
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  return (
    <div>
      <p className="text-xs text-white/40">{hint}</p>
      <div ref={listRef} className="nice-scroll mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="text-xs text-white/40">还没有消息{canChat ? "，来和队友商量一下吧" : ""}。</p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="text-xs leading-relaxed">
              <span className={cn("font-semibold", message.team === "red" ? "text-ember" : "text-storm")}>
                {message.username}
              </span>
              <span className="ml-1.5 tabular-nums text-white/30">{formatEventTime(message.at)}</span>
              <p className="break-words text-[13px] text-white/80">{message.text}</p>
            </div>
          ))
        )}
      </div>
      {canChat ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const text = input.trim();
            if (!text) return;
            onSend(text);
            setInput("");
          }}
          className="mt-3 flex gap-2"
        >
          <input
            className="h-9 min-w-0 flex-1 rounded-md border border-white/12 bg-black/25 px-3 text-sm outline-none transition placeholder:text-white/35 focus:border-storm/70 focus:ring-2 focus:ring-storm/20"
            value={input}
            maxLength={300}
            onChange={(event) => setInput(event.target.value)}
            placeholder="和队友商量…"
          />
          <Button type="submit" disabled={!input.trim()} className="px-3" aria-label="发送">
            <Send size={16} />
          </Button>
        </form>
      ) : null}
    </div>
  );
}
