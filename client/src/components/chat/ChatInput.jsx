import { useRef, useState } from "react";
import { Send } from "lucide-react";

function ChatInput({ onSubmit, disabled }) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef(null);

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setMessage("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex h-fit flex-col gap-2">
      <div className="flex items-center gap-2">
        <textarea
          id="assistant-prompt"
          ref={textareaRef}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          className="flex-1 resize-none rounded-2xl border border-zinc-800 bg-[#0b0c11] px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
          placeholder="Type your message..."
          disabled={disabled}
        />
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-cyan-500 text-slate-950 shadow-sm transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Send message"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        Enter to send • Shift + Enter for newline
      </p>
    </form>
  );
}

export default ChatInput;
