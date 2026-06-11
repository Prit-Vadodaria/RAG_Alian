import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Settings, LogOut, Sparkles } from "lucide-react";
import { useAuthStore } from "../store/authStore";

function AdminLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app-shell">
      <div className="relative flex h-full overflow-hidden">
        <aside className="flex w-80 flex-col border-r border-[rgba(255,255,255,0.08)] bg-[color:var(--surface-dark)] p-4 text-[color:var(--on-dark)]">
          <div className="flex items-center gap-3 rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[color:var(--surface-dark-soft)] p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-3xl bg-[rgba(200,255,87,0.12)] text-[color:var(--primary)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-kicker text-[color:var(--on-dark-soft)]">Admin Panel</p>
              <p className="text-sm font-semibold">{user?.name || "Administrator"}</p>
            </div>
          </div>

          <nav className="mt-6 space-y-2">
            <NavLink to="/admin" className={({ isActive }) => `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm ${isActive ? "bg-[color:var(--surface-dark-elevated)] text-[color:var(--on-dark)]" : "text-[color:var(--on-dark-soft)]"}`}>
              <LayoutDashboard className="h-4 w-4" />
              Overview
            </NavLink>
            <NavLink to="/admin/clients" className={({ isActive }) => `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm ${isActive ? "bg-[color:var(--surface-dark-elevated)] text-[color:var(--on-dark)]" : "text-[color:var(--on-dark-soft)]"}`}>
              <Users className="h-4 w-4" />
              Clients
            </NavLink>
            <NavLink to="/admin/config" className={({ isActive }) => `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm ${isActive ? "bg-[color:var(--surface-dark-elevated)] text-[color:var(--on-dark)]" : "text-[color:var(--on-dark-soft)]"}`}>
              <Settings className="h-4 w-4" />
              Config
            </NavLink>
          </nav>

          <button type="button" onClick={handleLogout} className="button-secondary mt-auto justify-center">
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </aside>
        <main className="relative flex-1 overflow-hidden px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
          <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col overflow-hidden">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
