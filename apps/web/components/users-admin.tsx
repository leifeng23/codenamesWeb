"use client";

import type { UserRole } from "@prisma/client";
import { Search, Shield } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "./ui/badge";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { Input } from "./ui/input";
import { Panel } from "./ui/panel";
import { useToast } from "./ui/toast";
import { cn } from "../lib/utils";

interface UserRow {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  createdAt: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "顶级管理员",
  WORD_EDITOR: "题库编辑者",
  USER: "玩家"
};

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  USER: "可创建、加入房间并游玩",
  WORD_EDITOR: "玩家权限之外，还可管理题库分类与词条",
  ADMIN: "题库编辑者权限之外，还可管理用户权限、邀请码与一级仓库"
};

const ROLE_TONES: Record<UserRole, "brass" | "storm" | "neutral"> = {
  ADMIN: "brass",
  WORD_EDITOR: "storm",
  USER: "neutral"
};

type RoleFilter = UserRole | "ALL";

export function UsersAdmin({ initialUsers }: { initialUsers: UserRow[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [pendingChange, setPendingChange] = useState<{ user: UserRow; nextRole: UserRole } | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== "ALL" && user.role !== roleFilter) return false;
      if (!keyword) return true;
      return user.username.toLowerCase().includes(keyword) || user.email.toLowerCase().includes(keyword);
    });
  }, [users, query, roleFilter]);

  async function confirmRoleChange() {
    if (!pendingChange) return;
    const { user, nextRole } = pendingChange;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole })
      });
      const data = await response.json();
      if (!response.ok) {
        toast.err(data.error ?? "权限保存失败");
        return;
      }
      setUsers((current) => current.map((item) => (item.id === user.id ? data : item)));
      toast.ok(`已将 ${user.username} 设为${ROLE_LABELS[nextRole]}`);
    } catch {
      toast.err("网络异常，请稍后重试");
    } finally {
      setSaving(false);
      setPendingChange(null);
    }
  }

  const filterOptions: Array<{ value: RoleFilter; label: string }> = [
    { value: "ALL", label: "全部" },
    { value: "USER", label: ROLE_LABELS.USER },
    { value: "WORD_EDITOR", label: ROLE_LABELS.WORD_EDITOR },
    { value: "ADMIN", label: ROLE_LABELS.ADMIN }
  ];

  return (
    <Panel className="mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Shield size={18} className="text-brass" />
          玩家权限
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setRoleFilter(option.value)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-semibold transition",
                  roleFilter === option.value
                    ? "bg-storm/20 text-storm"
                    : "bg-white/5 text-white/45 hover:bg-white/10 hover:text-white/70"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
            <Input
              className="h-9 w-52 pl-8"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索用户名 / 邮箱"
            />
          </div>
        </div>
      </div>

      {/* 角色说明 */}
      <div className="mt-3 grid gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] p-3 text-xs text-white/55 sm:grid-cols-3">
        {(["USER", "WORD_EDITOR", "ADMIN"] as UserRole[]).map((role) => (
          <p key={role}>
            <Badge tone={ROLE_TONES[role]} className="mr-1.5">
              {ROLE_LABELS[role]}
            </Badge>
            {ROLE_DESCRIPTIONS[role]}
          </p>
        ))}
      </div>

      <div className="nice-scroll mt-4 overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-white/[0.05] text-white/58">
            <tr>
              <th className="px-3 py-2.5">用户名</th>
              <th className="px-3 py-2.5">邮箱</th>
              <th className="px-3 py-2.5">当前权限</th>
              <th className="px-3 py-2.5">注册时间</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-sm text-white/35">
                  没有匹配的用户。
                </td>
              </tr>
            ) : (
              filtered.map((user) => (
                <tr key={user.id} className="border-t border-white/8 hover:bg-white/[0.02]">
                  <td className="px-3 py-2.5 font-semibold">{user.username}</td>
                  <td className="px-3 py-2.5 text-white/58">{user.email}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Badge tone={ROLE_TONES[user.role]}>{ROLE_LABELS[user.role]}</Badge>
                      <select
                        value={user.role}
                        onChange={(event) => {
                          const nextRole = event.target.value as UserRole;
                          if (nextRole !== user.role) setPendingChange({ user, nextRole });
                        }}
                        className="rounded-md border border-white/12 bg-black/30 px-2 py-1.5 text-xs"
                        aria-label={`调整 ${user.username} 的权限`}
                      >
                        <option value="USER">{ROLE_LABELS.USER}</option>
                        <option value="WORD_EDITOR">{ROLE_LABELS.WORD_EDITOR}</option>
                        <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-white/42">{new Date(user.createdAt).toLocaleString("zh-CN")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={pendingChange !== null}
        title="调整用户权限"
        body={
          pendingChange ? (
            <>
              <p>
                将 <span className="font-semibold text-white">{pendingChange.user.username}</span> 从「
                {ROLE_LABELS[pendingChange.user.role]}」改为「{ROLE_LABELS[pendingChange.nextRole]}」？
              </p>
              <p className="mt-2 text-xs text-white/45">
                {ROLE_LABELS[pendingChange.nextRole]}：{ROLE_DESCRIPTIONS[pendingChange.nextRole]}
              </p>
            </>
          ) : null
        }
        confirmLabel="确认调整"
        tone={pendingChange?.nextRole === "ADMIN" ? "danger" : "default"}
        pending={saving}
        onCancel={() => setPendingChange(null)}
        onConfirm={confirmRoleChange}
      />
    </Panel>
  );
}
