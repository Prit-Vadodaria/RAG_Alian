import { ChevronRight } from "lucide-react";

function SourceCard({ source, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(source)}
      className="group w-full rounded-3xl border border-zinc-800 bg-zinc-950 p-4 text-left transition hover:border-cyan-500 hover:bg-zinc-900"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-100">
            {source.source_id}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {source.title || source.url || "Unnamed source"}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-cyan-400 transition group-hover:translate-x-1" />
      </div>
      <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
        <span>Section: {source.section || "Unknown"}</span>
        <span>Rerank: {source.rerank_score?.toFixed(2) ?? "—"}</span>
      </div>
    </button>
  );
}

export default SourceCard;
