import { AdminNav } from "../../components/admin/admin-nav";
import { Starfield } from "../../components/starfield";
import { requireWordEditor } from "../../lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireWordEditor();

  return (
    <main className="min-h-screen px-4 py-6 md:px-6">
      <Starfield />
      <div className="mx-auto flex max-w-[88rem] flex-col gap-5 lg:flex-row">
        <aside className="shrink-0 lg:w-52">
          <p className="hidden px-3 text-xs uppercase tracking-[0.3em] text-brass lg:block">Admin Console</p>
          <div className="lg:mt-3">
            <AdminNav isAdmin={user.role === "ADMIN"} />
          </div>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </main>
  );
}
