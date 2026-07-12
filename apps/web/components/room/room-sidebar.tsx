"use client";

import type { RoomEventSummary, RoomSnapshot, Team, TeamChatMessage } from "@cosmere/shared";
import { MessageCircle, ScrollText, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Panel } from "../ui/panel";
import { Tabs } from "../ui/tabs";
import { EventLog } from "./event-log";
import { MemberList } from "./member-list";
import { TeamChat } from "./team-chat";

/** 聊天 / 成员 / 记录 三合一标签侧栏。 */
export function RoomSidebar({
  members,
  viewerIsOwner,
  onAssignRole,
  chatMessages,
  canChat,
  chatHint,
  onSendChat,
  events,
  cardTextByPosition,
  currentGameId
}: {
  members: RoomSnapshot["members"];
  viewerIsOwner: boolean;
  onAssignRole: (targetUserId: string, team: Team, canSpy: boolean) => void;
  chatMessages: TeamChatMessage[];
  canChat: boolean;
  chatHint: string;
  onSendChat: (text: string) => void;
  events: RoomEventSummary[];
  cardTextByPosition: Map<number, string> | null;
  currentGameId: string | null;
}) {
  const [tab, setTab] = useState("chat");
  const [unread, setUnread] = useState(0);

  // 聊天未激活时累计未读数
  useEffect(() => {
    if (tab !== "chat" && chatMessages.length > 0) {
      setUnread((current) => current + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMessages.length]);

  useEffect(() => {
    if (tab === "chat") setUnread(0);
  }, [tab, chatMessages.length]);

  return (
    <Panel>
      <Tabs
        items={[
          {
            value: "chat",
            label: "聊天",
            icon: <MessageCircle size={15} />,
            badge:
              unread > 0 ? (
                <span className="grid min-w-[1.1rem] place-items-center rounded-full bg-storm/30 px-1 text-[10px] font-bold text-storm">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : undefined
          },
          { value: "members", label: `成员 ${members.length}`, icon: <Users size={15} /> },
          { value: "log", label: "记录", icon: <ScrollText size={15} /> }
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="mt-3">
        {tab === "chat" ? (
          <TeamChat messages={chatMessages} canChat={canChat} hint={chatHint} onSend={onSendChat} />
        ) : tab === "members" ? (
          <MemberList members={members} viewerIsOwner={viewerIsOwner} onAssignRole={onAssignRole} />
        ) : (
          <EventLog events={events} cardTextByPosition={cardTextByPosition} currentGameId={currentGameId} />
        )}
      </div>
    </Panel>
  );
}
