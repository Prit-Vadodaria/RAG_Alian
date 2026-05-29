import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import CitationBadge from "../source/CitationBadge";

function MessageBubble({ message, onSelectSource }) {
  const isAssistant = message.role === "assistant";
  const createdAt = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div
      className={`group flex flex-col gap-4 rounded-[1.75rem] border px-5 py-5 shadow-sm transition ${
        isAssistant
          ? "border-zinc-800 bg-[#111317] text-zinc-100"
          : "self-end border-cyan-500/20 bg-cyan-500/10 text-zinc-100"
      }`}
    >
      <div className="flex items-center justify-between gap-4 text-xs text-zinc-500">
        <span className="font-semibold uppercase tracking-[0.3em]">
          {isAssistant ? "Assistant" : "You"}
        </span>
        <span>{createdAt}</span>
      </div>
      <div className="markdown-body text-sm leading-7 text-zinc-200">
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
              key={source.source_id || source.id}
              type="button"
              onClick={() => onSelectSource(source)}
              className="w-full rounded-3xl border border-zinc-800 bg-[#0d1015] px-4 py-3 text-left text-sm text-zinc-200 transition hover:border-cyan-500 hover:bg-[#111317]"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-zinc-100 truncate">
                  {source.source_id || source.id}
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
