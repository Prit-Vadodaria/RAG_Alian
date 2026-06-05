import { Loader2 } from "lucide-react";

function ThinkingBubble({ message }) {
  return (
    <div className="animate-pulse chat-message chat-message-system px-5 py-6">
      <div className="mb-3 flex items-center gap-3 text-sm font-semibold text-[color:var(--primary-strong)]">
        <Loader2 className="h-4 w-4 animate-spin text-[color:var(--primary)]" />
        <span>Assistant is thinking...</span>
      </div>
      <p className="text-sm text-[color:var(--body)]">{message}</p>
    </div>
  );
}

export default ThinkingBubble;
