import { useState } from "react";
import { Send } from "lucide-react";

function ChatInput({ onSubmit, disabled }) {
  const [message, setMessage] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setMessage("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4 shadow-sm shadow-cyan-500/5"
    >
      <label
        htmlFor="assistant-prompt"
        className="mb-2 block text-sm uppercase tracking-[0.3em] text-zinc-500"
      >
        Ask the workspace
      </label>
      <textarea
        id="assistant-prompt"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        rows={4}
        className="w-full resize-none rounded-3xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
        placeholder="Type a question and press enter to send..."
        disabled={disabled}
      />
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          The backend handles retrieval, grounding, and citation scoring.
        </p>
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
          <Send className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}

export default ChatInput;
