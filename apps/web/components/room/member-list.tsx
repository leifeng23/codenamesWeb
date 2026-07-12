"use client";

import type { RoomSnapshot, Team } from "@cosmere/shared";
import { Eye } from "lucide-react";
import { Badge } from "../ui/badge";
import { SegmentedControl } from "../ui/segmented";
import { cn } from "../../lib/utils";

type Member = RoomSnapshot["members"][number];

const teamOptions = [
  { value: "red" as Team, label: "红", activeClass: "bg-ember/30 text-ember" },
  { value: "blue" as Team, label: "蓝", activeClass: "bg-storm/30 text-storm" },
  { value: "spectator" as Team, label: "旁观", activeClass: "bg-white/15 text-white" }
];

export function MemberList({
  members,
  viewerIsOwner,
  onAssignRole
}: {
  members: Member[];
  viewerIsOwner: boolean;
  onAssignRole: (targetUserId: string, team: Team, canSpy: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      {viewerIsOwner ? (
        <p className="text-xs text-white/40">单击即可分配队伍；眼睛图标切换间谍身份。</p>
      ) : null}
      {members.map((member) => (
        <div
          key={member.userId}
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold">{member.username}</span>
            {member.isOwner ? <Badge tone="brass">房主</Badge> : null}
          </div>
          {viewerIsOwner ? (
            <div className="flex items-center gap-1.5">
              <SegmentedControl
                options={teamOptions}
                value={member.team}
                onChange={(team) => onAssignRole(member.userId, team, member.canSpy)}
              />
              <button
                type="button"
                onClick={() => onAssignRole(member.userId, member.team, !member.canSpy)}
                disabled={member.team === "spectator"}
                title={member.canSpy ? "当前是间谍，点击改为队员" : "当前是队员，点击改为间谍"}
                aria-pressed={member.canSpy}
                className={cn(
                  "grid size-7 place-items-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-35",
                  member.canSpy
                    ? "border-brass/50 bg-brass/20 text-brass"
                    : "border-white/12 bg-white/[0.05] text-white/50 hover:bg-white/10"
                )}
              >
                <Eye size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {member.team === "spectator" ? (
                <Badge tone="neutral">旁观</Badge>
              ) : (
                <Badge tone={member.team === "red" ? "ember" : "storm"}>
                  {member.team === "red" ? "红队" : "蓝队"}
                </Badge>
              )}
              {member.team !== "spectator" ? (
                <Badge tone={member.canSpy ? "brass" : "neutral"}>{member.canSpy ? "间谍" : "队员"}</Badge>
              ) : null}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
