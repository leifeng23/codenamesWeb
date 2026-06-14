"use client";

import type { UserRole } from "@prisma/client";
import { Shield } from "lucide-react";
import { useState } from "react";
import { Panel } from "./ui/panel";

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

export function UsersAdmin({ initialUsers }: { initialUsers: UserRow[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [message, setMessage] = useState("");

  async function updateRole(userId: string, role: UserRole) {
    setMessage("");
    const response = await fetch(`/api/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "权限保存失败");
      return;
    }
    setUsers((current) => current.map((user) => (user.id === userId ? data : user)));
    setMessage("权限已保存");
  }

  return (
    <Panel className="mt-8 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Shield size={20} className="text-brass" />
          玩家权限
        </h2>
        {message ? <p className="text-sm text-storm">{message}</p> : null}
      </div>
      <div className="mt-5 overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-white/[0.05] text-white/58">
            <tr>
              <th className="p-3">用户名</th>
              <th className="p-3">邮箱</th>
              <th className="p-3">当前权限</th>
              <th className="p-3">注册时间</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-white/8">
                <td className="p-3 font-semibold">{user.username}</td>
                <td className="p-3 text-white/58">{user.email}</td>
                <td className="p-3">
                  <select
                    value={user.role}
                    onChange={(event) => updateRole(user.id, event.target.value as UserRole)}
                    className="rounded-md border border-white/12 bg-black/30 px-3 py-2 text-sm"
                  >
                    <option value="USER">{ROLE_LABELS.USER}</option>
                    <option value="WORD_EDITOR">{ROLE_LABELS.WORD_EDITOR}</option>
                    <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
                  </select>
                </td>
                <td className="p-3 text-white/42">{new Date(user.createdAt).toLocaleString("zh-CN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
