import Link from "next/link";
import { AuthForm } from "../../components/auth-form";
import { Starfield } from "../../components/starfield";
import { Panel } from "../../components/ui/panel";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <Starfield />
      <Panel className="w-full max-w-md">
        <p className="text-sm uppercase tracking-[0.28em] text-storm/80">Codenames Fan Edition</p>
        <h1 className="mt-3 text-3xl font-black">Codenames同人在线版</h1>
        <p className="mt-2 text-sm text-white/58">使用邮箱或用户名登录，继续你的房间与对局记录。</p>
        <div className="mt-8">
          <AuthForm mode="login" />
        </div>
        <p className="mt-5 text-center text-sm text-white/52">
          还没有账号？{" "}
          <Link className="text-storm hover:text-white" href="/register">
            创建账号
          </Link>
        </p>
      </Panel>
    </main>
  );
}
