"use client";

import { Check, Copy, Plus, Ticket, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { Panel } from "./ui/panel";
import { SegmentedControl } from "./ui/segmented";
import { Spinner } from "./ui/spinner";
import { useToast } from "./ui/toast";

interface InviteRow {
  id: string;
  code: string;
  expiresAt: string | null;
  createdAt: string;
  usedAt: string | null;
  createdBy: { username: string };
  usedBy: { username: string } | null;
}

type Expiry = "never" | "7d" | "30d";

const expiryOptions = [
  { value: "never" as Expiry, label: "永久有效" },
  { value: "7d" as Expiry, label: "7 天" },
  { value: "30d" as Expiry, label: "30 天" }
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", { dateStyle: "short", timeStyle: "short" });
}

function inviteStatus(invite: InviteRow): { label: string; tone: "storm" | "neutral" | "ember" } {
  if (invite.usedBy) return { label: `已使用 · ${invite.usedBy.username}`, tone: "neutral" };
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now())
    return { label: "已过期", tone: "ember" };
  return { label: "未使用", tone: "storm" };
}

export function InvitesAdmin({ initialInvites }: { initialInvites: InviteRow[] }) {
  const [invites, setInvites] = useState(initialInvites);
  const [expiry, setExpiry] = useState<Expiry>("never");
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<InviteRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  async function copyCode(invite: InviteRow) {
    try {
      await navigator.clipboard.writeText(invite.code);
      setCopiedId(invite.id);
      setTimeout(() => setCopiedId((current) => (current === invite.id ? null : current)), 1600);
    } catch {
      toast.err("复制失败，请手动复制");
    }
  }

  async function createInvite() {
    if (creating) return;
    setCreating(true);
    try {
      const expiresAt =
        expiry === "never"
          ? undefined
          : new Date(Date.now() + (expiry === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000).toISOString();
      const response = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expiresAt ? { expiresAt } : {})
      });
      const data = await response.json();
      if (!response.ok) {
        toast.err(data.error ?? "生成失败");
        return;
      }
      setInvites((current) => [data, ...current]);
      try {
        await navigator.clipboard.writeText(data.code);
        toast.ok(`已生成邀请码 ${data.code}，并复制到剪贴板`);
      } catch {
        toast.ok(`已生成邀请码 ${data.code}`);
      }
    } catch {
      toast.err("网络异常，请稍后重试");
    } finally {
      setCreating(false);
    }
  }

  async function deleteInvite(invite: InviteRow) {
    setDeleting(true);
    try {
      const response = await fetch(`/api/invites/${invite.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.err(data.error ?? "删除失败");
        return;
      }
      setInvites((current) => current.filter((item) => item.id !== invite.id));
      toast.ok("邀请码已删除");
    } catch {
      toast.err("网络异常，请稍后重试");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  }

  return (
    <Panel className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Ticket size={18} className="text-brass" />
          <p className="text-sm text-white/55">生成邀请码发给朋友，注册时填写即可创建账号。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl options={expiryOptions} value={expiry} onChange={setExpiry} />
          <Button variant="primary" onClick={createInvite} disabled={creating}>
            {creating ? <Spinner size={16} /> : <Plus size={16} />}
            生成邀请码
          </Button>
        </div>
      </div>

      <div className="nice-scroll mt-5 overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead className="bg-white/[0.05] text-white/58">
            <tr>
              <th className="px-3 py-2.5">邀请码</th>
              <th className="px-3 py-2.5">状态</th>
              <th className="px-3 py-2.5">创建者</th>
              <th className="px-3 py-2.5">创建时间</th>
              <th className="px-3 py-2.5">有效期至</th>
              <th className="w-16 px-3 py-2.5 text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {invites.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-white/35">
                  还没有邀请码，点击上方按钮生成第一个。
                </td>
              </tr>
            ) : (
              invites.map((invite) => {
                const status = inviteStatus(invite);
                return (
                  <tr key={invite.id} className="border-t border-white/8 hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-sm font-bold tracking-widest">{invite.code}</span>
                      <button
                        onClick={() => copyCode(invite)}
                        className="ml-2 rounded p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
                        aria-label="复制邀请码"
                      >
                        {copiedId === invite.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-white/58">{invite.createdBy.username}</td>
                    <td className="px-3 py-2.5 text-white/42">{formatDate(invite.createdAt)}</td>
                    <td className="px-3 py-2.5 text-white/42">
                      {invite.expiresAt ? formatDate(invite.expiresAt) : "永久"}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {!invite.usedBy ? (
                        <button
                          onClick={() => setConfirmDelete(invite)}
                          title="删除邀请码"
                          className="rounded p-1.5 text-white/35 transition hover:bg-ember/15 hover:text-ember"
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="删除邀请码"
        body={confirmDelete ? `确认删除邀请码 ${confirmDelete.code}？删除后将无法用于注册。` : null}
        confirmLabel="删除"
        tone="danger"
        pending={deleting}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && deleteInvite(confirmDelete)}
      />
    </Panel>
  );
}
