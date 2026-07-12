import type { Faction, RoomEventSummary, TurnTeam } from "@cosmere/shared";

// 翻开后的卡背阵营色
export const backFactionClass: Record<Faction, string> = {
  red: "bg-gradient-to-br from-rose-500/90 to-red-700/95 text-red-50 shadow-[0_0_36px_rgba(255,80,70,.45)]",
  blue: "bg-gradient-to-br from-sky-400/90 to-blue-700/95 text-cyan-50 shadow-[0_0_36px_rgba(80,180,255,.45)]",
  neutral: "bg-gradient-to-br from-amber-300/85 to-amber-600/85 text-amber-950",
  assassin: "bg-gradient-to-br from-zinc-800 to-black text-white shadow-[0_0_48px_rgba(0,0,0,.9)] ring-2 ring-red-600/60"
};

// 间谍视角下未翻开卡牌的阵营提示
export const hintFactionClass: Record<Faction, string> = {
  red: "ring-1 ring-rose-400/50 bg-rose-500/[0.12]",
  blue: "ring-1 ring-sky-400/50 bg-sky-500/[0.12]",
  neutral: "ring-1 ring-amber-300/40 bg-amber-400/[0.07]",
  assassin: "ring-1 ring-zinc-200/40 bg-black/40"
};

export const ringColorClass: Record<Faction, string> = {
  red: "text-rose-400",
  blue: "text-sky-400",
  neutral: "text-amber-300",
  assassin: "text-red-500"
};

export const teamColorHex: Record<TurnTeam, string> = { red: "#ff5d4d", blue: "#5bd7ff" };

export const teamLabel: Record<TurnTeam, string> = { red: "红队", blue: "蓝队" };

export const factionResultLabel: Record<Faction, string> = {
  red: "红方特工",
  blue: "蓝方特工",
  neutral: "路人",
  assassin: "刺客"
};

export function formatEventTime(iso: string) {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** 把服务端下发的安全事件摘要转成可读文案；未知类型返回 null 不展示。 */
export function describeEvent(
  event: RoomEventSummary,
  cardTextByPosition: Map<number, string> | null,
  currentGameId: string | null
): string | null {
  const actor = event.actorName ?? "某成员";
  const data = event.data;
  switch (event.type) {
    case "game.started":
      return `${actor} 开始了新对局`;
    case "turn.clue_submitted":
      return `${data.turnTeam ? teamLabel[data.turnTeam] : ""}间谍 ${actor} 给出线索「${data.clueWord} ${data.clueCount}」`;
    case "card.revealed": {
      const sameGame = event.gameId != null && event.gameId === currentGameId;
      const text = sameGame && data.position != null ? cardTextByPosition?.get(data.position) : null;
      const target = text ? `「${text}」` : data.position != null ? `第 ${data.position + 1} 张牌` : "一张牌";
      return `${actor} 翻开${target}${data.faction ? ` → ${factionResultLabel[data.faction]}` : ""}`;
    }
    case "turn.ended":
      return data.reason === "manual"
        ? `${actor} 结束了回合`
        : data.nextTurnTeam
          ? `回合结束，轮到${teamLabel[data.nextTurnTeam]}`
          : "回合结束";
    case "game.finished":
      return data.winnerTeam
        ? `${teamLabel[data.winnerTeam]}获胜${data.reason === "assassin" ? "（对方翻中刺客）" : ""}`
        : "对局结束";
    case "member.role_assigned": {
      const role =
        data.team === "spectator"
          ? "旁观"
          : `${data.team ? teamLabel[data.team as TurnTeam] : ""}${data.canSpy ? "间谍" : "队员"}`;
      return `${actor} 将 ${data.targetName ?? "成员"} 设为${role}`;
    }
    case "room.categories_updated":
      return `${actor} 更新了题库${data.categoryCount != null ? `（${data.categoryCount} 个分类）` : ""}`;
    default:
      return null;
  }
}
