import Link from "next/link";
import { AuthForm } from "../../components/auth-form";
import { Starfield } from "../../components/starfield";
import { Panel } from "../../components/ui/panel";

export default function RegisterPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <Starfield />
      <Panel className="w-full max-w-md">
        <p className="text-sm uppercase tracking-[0.28em] text-brass/90">Invite Only</p>
        <h1 className="mt-3 text-3xl font-black">登记行动员</h1>
        <p className="mt-2 text-sm text-white/58">第一版使用邀请制注册，避免陌生账号进入私密桌游局。</p>
        <div className="mt-8">
          <AuthForm mode="register" />
        </div>
        <p className="mt-5 text-center text-sm text-white/52">
          已有账号？{" "}
          <Link className="text-storm hover:text-white" href="/login">
            登录
          </Link>
        </p>
      </Panel>
    </main>
  );
}
