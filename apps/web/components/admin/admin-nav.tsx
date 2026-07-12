"use client";

import { ArrowLeft, BookOpen, Shield, Ticket } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/utils";

const items = [
  { href: "/admin/words", label: "题库", icon: BookOpen, adminOnly: false },
  { href: "/admin/users", label: "用户", icon: Shield, adminOnly: true },
  { href: "/admin/invites", label: "邀请码", icon: Ticket, adminOnly: true }
];

export function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 lg:flex-col">
      {items
        .filter((item) => !item.adminOnly || isAdmin)
        .map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition",
                active
                  ? "bg-storm/15 text-storm"
                  : "text-white/55 hover:bg-white/[0.07] hover:text-white"
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      <div className="mx-1 hidden border-t border-white/10 lg:my-2 lg:block" />
      <Link
        href="/"
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-white/45 transition hover:bg-white/[0.07] hover:text-white"
      >
        <ArrowLeft size={16} />
        返回行动台
      </Link>
    </nav>
  );
}
