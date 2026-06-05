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
          rows={1}
          className="field-dark h-12 flex-1 resize-none px-4 py-3 text-sm"
          placeholder="Type your message..."
          disabled={disabled}
        />
        <button
          type="submit"
          disabled={disabled}
          className="button-primary h-12 w-12 flex-shrink-0 px-0 py-0"
          aria-label="Send message"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
      <p className="text-xs text-[color:var(--on-dark-soft)]">
        Enter to send • Shift + Enter for newline
      </p>
    </form>
  );
}

export default ChatInput;
