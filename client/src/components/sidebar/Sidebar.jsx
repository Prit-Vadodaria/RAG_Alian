import { NavLink, useNavigate } from "react-router-dom";
import {
  MessageSquare,
  Bot,
  Cpu,
  SlidersHorizontal,
  Plus,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

import NewChatButton from "./NewChatButton";
import ChatList from "./ChatList";
import { useChatStore } from "../../store/chatStore";
import ContextSelector from "../context/ContextSelector";

function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }) {
  const navigate = useNavigate();
  const createChat = useChatStore((state) => state.createChat);

  const handleNewChat = () => {
    createChat();
    navigate("/");
    onClose?.();
  };
  const widthClass = collapsed ? "w-16" : "w-80";
  const paddingClass = collapsed ? "p-2" : "p-4";

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
                  to="/settings#knowledge-contexts"
                  onClick={onClose}
                  className="button-secondary"
                  aria-label="Manage contexts in settings"
                >
                  <Plus className="h-4 w-4" />
                  <span>Contexts</span>
                </NavLink>
              </div>

              <div className="flex-shrink-0">
                <ContextSelector />
              </div>

              <div className="surface-dark-soft flex min-h-0 flex-1 flex-col overflow-hidden p-4">
                <h2 className="mb-4 text-kicker text-[color:var(--on-dark-soft)]">
                  Conversations
                </h2>
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  <ChatList onAfterSelect={onClose} />
                </div>
              </div>
            </div>

            <div className="mt-5 flex-shrink-0">
              <nav className="surface-dark-soft space-y-2 p-3">
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition ${
                      isActive
                        ? "border border-[rgba(255,255,255,0.08)] bg-[color:var(--surface-dark-elevated)] text-[color:var(--on-dark)]"
                        : "text-[color:var(--on-dark-soft)]"
                    }`
                  }
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Chat</span>
                </NavLink>
                <NavLink
                  to="/chatbots"
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition ${
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
                  to="/system"
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition ${
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
                  to="/settings"
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition ${
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
          </>
        )}
      </aside>
    </>
  );
}

export default Sidebar;
