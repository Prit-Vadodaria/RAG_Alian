import { MessageSquare } from "lucide-react";

function ChatHeader({ title, messageCount }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-3xl border border-zinc-800 bg-zinc-900 px-5 py-4 shadow-sm shadow-cyan-500/5">
      <div>
        <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">
          Workspace conversation
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-100">{title}</h1>
      </div>
      <div className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
        <MessageSquare className="h-4 w-4 text-cyan-400" />
        {messageCount} messages
      </div>
    </div>
  );
}

export default ChatHeader;
