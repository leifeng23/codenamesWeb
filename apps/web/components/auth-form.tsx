"use client";

import { useState } from "react";
import { LogIn, UserPlus } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(formData: FormData) {
    setLoading(true);
    setError("");
    const body = Object.fromEntries(formData);
    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register-with-invite";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "请求失败");
      return;
    }
    window.location.href = "/";
  }

  return (
    <form action={submit} className="space-y-4">
      <Input name="email" type="email" placeholder="邮箱" required />
      <Input name="password" type="password" placeholder="密码" required minLength={mode === "register" ? 8 : undefined} />
      {mode === "register" ? <Input name="inviteCode" placeholder="邀请码" required /> : null}
      {error ? <p className="text-sm text-ember">{error}</p> : null}
      <Button className="w-full bg-storm/18" disabled={loading}>
        {mode === "login" ? <LogIn size={18} /> : <UserPlus size={18} />}
        {loading ? "处理中..." : mode === "login" ? "登录行动台" : "创建账号"}
      </Button>
    </form>
  );
}
