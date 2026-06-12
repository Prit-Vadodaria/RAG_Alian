import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Globe,
  Bot,
} from "lucide-react";
import { useAuthStore } from "../store/authStore";

function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [configOpen, setConfigOpen] = useState(location.pathname.startsWith("/admin/config"));

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      if (location.pathname.startsWith("/admin/config")) {
        setConfigOpen(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const subNavClass = ({ isActive }) =>
    `block rounded-2xl px-4 py-3 text-sm font-medium transition ${
      isActive
        ? "bg-[color:var(--surface-dark-elevated)] text-[color:var(--on-dark)] shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
        : "text-[color:var(--on-dark-soft)] hover:bg-[color:var(--surface-dark-elevated)] hover:text-[color:var(--on-dark)]"
    }`;

  return (
    <div className="app-shell">
      <div className="relative flex h-full overflow-hidden">
        <aside className="flex w-80 flex-col border-r border-[var(--hairline)] bg-[color:var(--surface-dark)] p-4 text-[color:var(--on-dark)]">
          <div className="flex items-center gap-3 rounded-3xl border border-[var(--hairline)] bg-[color:var(--surface-dark-soft)] p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-3xl bg-[color:var(--accent-soft-strong)] text-[color:var(--primary)]">
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
            <NavLink to="/admin/contexts" className={({ isActive }) => `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm ${isActive ? "bg-[color:var(--surface-dark-elevated)] text-[color:var(--on-dark)]" : "text-[color:var(--on-dark-soft)]"}`}>
              <Globe className="h-4 w-4" />
              Web Contexts
            </NavLink>
            <NavLink to="/admin/chatbots" className={({ isActive }) => `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm ${isActive ? "bg-[color:var(--surface-dark-elevated)] text-[color:var(--on-dark)]" : "text-[color:var(--on-dark-soft)]"}`}>
              <Bot className="h-4 w-4" />
              Chatbots
            </NavLink>
            <button
              type="button"
              onClick={() => setConfigOpen((value) => !value)}
              className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm ${
                location.pathname.startsWith("/admin/config")
                  ? "bg-[color:var(--surface-dark-elevated)] text-[color:var(--on-dark)]"
                  : "text-[color:var(--on-dark-soft)]"
              }`}
            >
              <div className="flex items-center gap-3">
                <Settings className="h-4 w-4" />
                Configuration
              </div>
              {configOpen ? (
                <ChevronUp className="h-3 w-3 opacity-60" />
              ) : (
                <ChevronDown className="h-3 w-3 opacity-60" />
              )}
            </button>
            {configOpen ? (
              <div className="ml-4 mt-2 flex flex-col gap-2 border-l border-[var(--hairline)] pl-4">
                <NavLink to="/admin/config/registration" className={subNavClass}>
                  Registration
                </NavLink>
                <NavLink to="/admin/config/embedding" className={subNavClass}>
                  Embedding
                </NavLink>
                <NavLink to="/admin/config/reranking" className={subNavClass}>
                  Reranking
                </NavLink>
                <NavLink to="/admin/config/retrieval" className={subNavClass}>
                  Retrieval
                </NavLink>
                <NavLink to="/admin/config/ingestion" className={subNavClass}>
                  Ingestion
                </NavLink>
                <NavLink to="/admin/config/prompt-seed" className={subNavClass}>
                  Prompt Seed
                </NavLink>
              </div>
            ) : null}
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
