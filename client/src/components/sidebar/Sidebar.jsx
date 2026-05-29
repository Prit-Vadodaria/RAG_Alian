import { NavLink } from "react-router-dom";
import {
  MessageSquare,
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
import AddContextModal from "../context/AddContextModal";
import { useState } from "react";

function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }) {
  const createChat = useChatStore((state) => state.createChat);
  const [showModal, setShowModal] = useState(false);
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
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-white/10 bg-[#101118] ${paddingClass} transition-transform duration-300 sm:static sm:translate-x-0 ${widthClass} ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {collapsed ? (
          <div className="flex h-full flex-col items-center justify-start gap-4 pt-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-cyan-500/10 text-cyan-300">
              <Sparkles className="h-6 w-6" />
            </div>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-cyan-300 transition hover:border-cyan-500 hover:text-cyan-100"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-3xl bg-cyan-500/10 text-cyan-300">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">
                    Workspace
                  </p>
                  <h2 className="text-sm font-semibold text-zinc-100">
                    Alian private AI
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-300 transition hover:border-cyan-500 hover:text-cyan-200"
                  aria-label="Collapse sidebar"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-300 transition hover:border-cyan-500 hover:text-cyan-200 sm:hidden"
                  aria-label="Close sidebar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <NewChatButton onCreate={createChat} className="flex-1" />
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center justify-center rounded-2xl border border-cyan-500 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-300 transition hover:border-cyan-400 hover:bg-cyan-500/15"
                  aria-label="Add website context"
                >
                  <Plus className="h-4 w-4" />
                  <span> Add Website</span>
                </button>
              </div>

              <div>
                <ContextSelector />
              </div>

              <div className="rounded-[1.75rem] border border-zinc-800 bg-[#0f1116] p-4 shadow-sm shadow-cyan-500/5">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.32em] text-zinc-400">
                  Conversations
                </h2>
                <ChatList />
              </div>
            </div>

            {showModal && (
              <AddContextModal
                onClose={() => {
                  setShowModal(false);
                }}
              />
            )}

            <div className="mt-auto space-y-3">
              <nav className="space-y-3 rounded-[1.75rem] border border-zinc-800 bg-[#0f1116] p-4">
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition ${
                      isActive
                        ? "border border-cyan-500 bg-zinc-950 text-cyan-200"
                        : "text-zinc-400 hover:border hover:border-zinc-700 hover:text-zinc-200"
                    }`
                  }
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Chat</span>
                </NavLink>
                <NavLink
                  to="/system"
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition ${
                      isActive
                        ? "border border-cyan-500 bg-zinc-950 text-cyan-200"
                        : "text-zinc-400 hover:border hover:border-zinc-700 hover:text-zinc-200"
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
                        ? "border border-cyan-500 bg-zinc-950 text-cyan-200"
                        : "text-zinc-400 hover:border hover:border-zinc-700 hover:text-zinc-200"
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
