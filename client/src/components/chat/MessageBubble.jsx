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
      {message.citations?.length || message.sources?.length ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {message.sources?.length
            ? message.sources.map((source) => (
                <CitationBadge
                  key={source.source_id || source.id}
                  label={source.source_id || source.id || "Source"}
                  onClick={() => onSelectSource(source)}
                />
              ))
            : message.citations.map((cite) => (
                <CitationBadge key={cite} label={cite} />
              ))}
        </div>
      ) : null}
    </div>
  );
}

export default MessageBubble;
