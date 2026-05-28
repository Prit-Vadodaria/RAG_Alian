import { Trash2 } from "lucide-react";
import { formatTime } from "../../utils/format";

function ConversationItem({ chat, active, onSelect, onDelete }) {
  return (
    <div
      className={`group flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 transition ${
        active
          ? "border-cyan-500 bg-zinc-900 text-cyan-100 shadow-cyan-500/10"
          : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900"
      }`}
    >
      <button
        type="button"
        className="text-left"
        onClick={() => onSelect(chat.id)}
      >
        <p className="text-sm font-semibold truncate">{chat.title}</p>
        <p className="mt-1 text-xs text-zinc-500">
          {formatTime(chat.createdAt)}
        </p>
      </button>
      <button
        type="button"
        onClick={() => onDelete(chat.id)}
        className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-900 hover:text-rose-400"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export default ConversationItem;
