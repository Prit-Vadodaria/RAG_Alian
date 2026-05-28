import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import CitationBadge from "../source/CitationBadge";

function MessageBubble({ message, onSelectSource }) {
  const isAssistant = message.role === "assistant";

  return (
    <div
      className={`group rounded-3xl border px-5 py-4 shadow-sm transition ${
        isAssistant
          ? "border-zinc-800 bg-zinc-900 text-zinc-100"
          : "border-zinc-800 bg-zinc-950 text-zinc-200 self-end"
      }`}
    >
      <div className="mb-3 flex items-center gap-3 text-sm font-semibold text-zinc-300">
        <span
          className={`inline-flex h-8 w-8 items-center justify-center rounded-2xl ${isAssistant ? "bg-cyan-500/10 text-cyan-300" : "bg-zinc-800 text-zinc-200"}`}
        >
          {isAssistant ? "AI" : "You"}
        </span>
        <span>{isAssistant ? "Assistant response" : "User prompt"}</span>
      </div>
      <div className="markdown-body max-w-none space-y-4 text-sm leading-7 text-zinc-100">
        <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
          {message.content}
        </ReactMarkdown>
      </div>
      {message.citations?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {message.citations.map((cite) => (
            <CitationBadge key={cite} label={cite} />
          ))}
        </div>
      ) : null}
      {isAssistant && message.sources?.length ? (
        <div className="mt-5 space-y-3">
          {message.sources.map((source) => (
            <button
              key={source.source_id}
              type="button"
              onClick={() => onSelectSource(source)}
              className="w-full rounded-3xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-left text-sm text-zinc-200 transition hover:border-cyan-500 hover:bg-zinc-900"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-zinc-100">
                  {source.source_id}
                </span>
                <span className="text-xs text-zinc-500">
                  {source.section || "Section unavailable"}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-400 truncate">
                {source.title || source.url || "Source text unavailable"}
              </p>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default MessageBubble;
