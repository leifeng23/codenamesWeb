import Link from "next/link";
import { redirect } from "next/navigation";
import { HomeActions } from "../components/home-actions";
import { Starfield } from "../components/starfield";
import { Panel } from "../components/ui/panel";
import { currentUser } from "../lib/auth";

export default async function HomePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen px-4 py-8">
      <Starfield />
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-storm/70">Cosmere CodeNames</p>
          <h1 className="mt-2 text-4xl font-black">星图密令行动台</h1>
        </div>
        {user.role === "ADMIN" ? (
          <Link className="rounded-md border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10" href="/admin/words">
            题库后台
          </Link>
        ) : null}
      </div>
      <div className="mx-auto mt-12 grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="scanlines relative min-h-[480px] overflow-hidden rounded-lg border border-white/10 bg-black/20 p-8">
          <div className="max-w-xl">
            <p className="text-sm text-brass">行动员：{user.email}</p>
            <h2 className="mt-5 text-5xl font-black leading-tight">创建房间，抽取 25 张密令牌。</h2>
            <p className="mt-5 max-w-lg text-white/62">
              房间码邀请朋友加入，间谍权限由房主控制。所有翻牌、阵营和事件都会被保存，方便中途恢复和回看。
            </p>
          </div>
        </section>
        <Panel className="self-start">
          <h2 className="text-xl font-bold">房间</h2>
          <p className="mt-2 text-sm text-white/56">没有公开大厅，第一版专注朋友局。</p>
          <div className="mt-6">
            <HomeActions />
          </div>
        </Panel>
      </div>
    </main>
  );
}
