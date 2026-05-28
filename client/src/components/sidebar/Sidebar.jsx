import { NavLink } from "react-router-dom";
import { MessageSquare, Cpu, SlidersHorizontal } from "lucide-react";

import NewChatButton from "./NewChatButton";
import ChatList from "./ChatList";
import { useChatStore } from "../../store/chatStore";

function Sidebar() {
  const createChat = useChatStore((state) => state.createChat);

  return (
    <aside className="hidden w-80 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 p-4 md:flex">
      <div className="space-y-4">
        <NewChatButton onCreate={createChat} />
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4 shadow-sm shadow-cyan-500/10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.32em] text-zinc-400">
            Conversations
          </h2>
          <ChatList />
        </div>
      </div>
      <div className="mt-auto space-y-3">
        <nav className="space-y-3 rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
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
            Chat
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
            System
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
            Settings
          </NavLink>
        </nav>
      </div>
    </aside>
  );
}

export default Sidebar;
