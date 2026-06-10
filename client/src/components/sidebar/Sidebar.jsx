import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Bot,
  Cpu,
  Globe,
  SlidersHorizontal,
  LayoutDashboard,
  Plus,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X,
  ChevronUp,
  ChevronDown,
  UserRound,
} from "lucide-react";

import NewChatButton from "./NewChatButton";
import ChatList from "./ChatList";
import { useChatStore } from "../../store/chatStore";
import ContextSelector from "../context/ContextSelector";

function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }) {
  const navigate = useNavigate();
  const createChat = useChatStore((state) => state.createChat);
  const sidebarRef = useRef(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const handleNewChat = () => {
    createChat();
    navigate("/");
    onClose?.();
  };
  const handleProfileNavClick = () => {
    setProfileMenuOpen(false);
    onClose?.();
  };

  useEffect(() => {
    if (!profileMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!sidebarRef.current?.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [profileMenuOpen]);

  const widthClass = collapsed ? "w-16" : "w-80";
  const paddingClass = collapsed ? "p-2" : "p-4";
  const showProfileMenu = profileMenuOpen && !collapsed;

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-black/70 transition-opacity sm:hidden ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      <aside
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-40 flex h-full flex-col overflow-hidden border-r border-[rgba(255,255,255,0.08)] bg-[color:var(--surface-dark)] text-[color:var(--on-dark)] ${paddingClass} transition-transform duration-300 sm:static sm:translate-x-0 ${widthClass} ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {collapsed ? (
          <div className="flex h-full flex-col items-center justify-start gap-4 pt-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[color:var(--surface-dark-soft)] text-[color:var(--primary)]">
              <Sparkles className="h-6 w-6" />
            </div>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="button-icon"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex-shrink-0 mb-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[color:var(--surface-dark-soft)] text-[color:var(--primary)]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-kicker text-[color:var(--on-dark-soft)]">
                    Workspace
                  </p>
                  <h2 className="text-sm font-semibold text-[color:var(--on-dark)]">
                    Alian private AI
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  className="button-icon"
                  aria-label="Collapse sidebar"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="button-icon sm:hidden"
                  aria-label="Close sidebar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
              <div className="flex-shrink-0 flex items-center gap-2">
                <NewChatButton onCreate={handleNewChat} className="flex-1" />
                <NavLink
                  to="/contexts"
                  onClick={onClose}
                  className="button-secondary"
                  aria-label="Manage contexts"
                >
                  <Plus className="h-4 w-4" />
                  <span>Contexts</span>
                </NavLink>
              </div>

              <div className="flex-shrink-0">
                <ContextSelector />
              </div>

              <div className="surface-dark-soft flex min-h-0 flex-1 flex-col overflow-hidden !rounded-[0.5rem] p-4">
                <h2 className="mb-4 text-kicker text-[color:var(--on-dark-soft)]">
                  Conversations
                </h2>
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  <ChatList onAfterSelect={onClose} />
                </div>
              </div>
            </div>

            <div className="mt-3 flex-shrink-0">
              {showProfileMenu && (
                <div className="mb-3 max-h-[calc(100vh-18rem)] overflow-y-auto surface-dark-soft !rounded-[0.5rem] p-3 pr-2 shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
                  <nav className="space-y-2">
                    <NavLink
                      to="/dashboard"
                      onClick={handleProfileNavClick}
                      className={({ isActive }) =>
                        `flex items-center gap-3 !rounded-[0.5rem] px-3 py-3 text-sm font-medium transition ${
                          isActive
                            ? "border border-[rgba(255,255,255,0.08)] bg-[color:var(--surface-dark-elevated)] text-[color:var(--on-dark)]"
                            : "text-[color:var(--on-dark-soft)]"
                        }`
                      }
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      <span>Dashboard</span>
                    </NavLink>
                    <NavLink
                      to="/chatbots"
                      onClick={handleProfileNavClick}
                      className={({ isActive }) =>
                        `flex items-center gap-3 !rounded-[0.5rem] px-3 py-3 text-sm font-medium transition ${
                          isActive
                            ? "border border-[rgba(255,255,255,0.08)] bg-[color:var(--surface-dark-elevated)] text-[color:var(--on-dark)]"
                            : "text-[color:var(--on-dark-soft)]"
                        }`
                      }
                    >
                      <Bot className="h-4 w-4" />
                      <span>Chatbots</span>
                    </NavLink>
                    <NavLink
                      to="/contexts"
                      onClick={handleProfileNavClick}
                      className={({ isActive }) =>
                        `flex items-center gap-3 !rounded-[0.5rem] px-3 py-3 text-sm font-medium transition ${
                          isActive
                            ? "border border-[rgba(255,255,255,0.08)] bg-[color:var(--surface-dark-elevated)] text-[color:var(--on-dark)]"
                            : "text-[color:var(--on-dark-soft)]"
                        }`
                      }
                    >
                      <Globe className="h-4 w-4" />
                      <span>Contexts</span>
                    </NavLink>
                    <NavLink
                      to="/system"
                      onClick={handleProfileNavClick}
                      className={({ isActive }) =>
                        `flex items-center gap-3 !rounded-[0.5rem] px-3 py-3 text-sm font-medium transition ${
                          isActive
                            ? "border border-[rgba(255,255,255,0.08)] bg-[color:var(--surface-dark-elevated)] text-[color:var(--on-dark)]"
                            : "text-[color:var(--on-dark-soft)]"
                        }`
                      }
                    >
                      <Cpu className="h-4 w-4" />
                      <span>System</span>
                    </NavLink>
                    <NavLink
                      to="/prompt-settings"
                      onClick={handleProfileNavClick}
                      className={({ isActive }) =>
                        `flex items-center gap-3 !rounded-[0.5rem] px-3 py-3 text-sm font-medium transition ${
                          isActive
                            ? "border border-[rgba(255,255,255,0.08)] bg-[color:var(--surface-dark-elevated)] text-[color:var(--on-dark)]"
                            : "text-[color:var(--on-dark-soft)]"
                        }`
                      }
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      <span>Settings</span>
                    </NavLink>
                  </nav>
                </div>
              )}

              <button
                type="button"
                onClick={() => setProfileMenuOpen((value) => !value)}
                className={`surface-dark-soft flex w-full items-center justify-between gap-3 !rounded-[0.5rem] px-3 py-3 text-left transition hover:bg-[color:var(--surface-dark-elevated)] ${
                  profileMenuOpen
                    ? "border-[rgba(255,255,255,0.16)]"
                    : "border-[rgba(255,255,255,0.08)]"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[color:var(--surface-dark-elevated)] text-[color:var(--primary)]">
                    <UserRound className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[color:var(--on-dark)]">
                      Alian Demo
                    </p>
                    <p className="truncate text-xs text-[color:var(--on-dark-soft)]">
                      Workspace profile
                    </p>
                  </div>
                </div>
                {showProfileMenu ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-[color:var(--on-dark-soft)]" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--on-dark-soft)]" />
                )}
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

export default Sidebar;
