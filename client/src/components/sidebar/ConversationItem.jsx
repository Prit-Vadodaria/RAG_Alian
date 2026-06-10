import { Trash2 } from "lucide-react";
import { formatTime } from "../../utils/format";

function ConversationItem({ chat, active, onSelect, onDelete }) {
  return (
    <div
      className={`group flex items-center justify-between gap-3 !rounded-[0.5rem] border px-3 py-3 transition ${
        active
          ? "border-[rgba(201,119,92,0.28)] bg-[rgba(201,119,92,0.12)] text-[color:var(--on-dark)]"
          : "border-[rgba(255,255,255,0.08)] bg-[color:var(--surface-dark-soft)] text-[color:var(--on-dark-soft)] hover:border-[rgba(255,255,255,0.14)] hover:bg-[color:var(--surface-dark-elevated)] hover:text-[color:var(--on-dark)]"
      }`}
    >
      <button
        type="button"
        className="flex-1 min-w-0 text-left"
        onClick={() => onSelect(chat.id)}
      >
        <p className="truncate text-sm font-semibold">{chat.title}</p>
        <p className="mt-1 text-xs text-[color:var(--on-dark-soft)]">
          {formatTime(chat.createdAt)}
        </p>
      </button>
      <button
        type="button"
        onClick={() => onDelete(chat.id)}
        className="shrink-0 rounded-full p-2 text-[color:var(--on-dark-soft)] transition hover:bg-[color:var(--surface-dark-elevated)] hover:text-[color:var(--error)]"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export default ConversationItem;
