"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { Spinner } from "./ui/spinner";

export function LogoutButton() {
  const [pending, setPending] = useState(false);

  async function logout() {
    if (pending) return;
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <button
      onClick={logout}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
    >
      {pending ? <Spinner size={15} /> : <LogOut size={15} />}
      退出登录
    </button>
  );
}
