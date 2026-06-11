import { ChevronRight } from "lucide-react";

function SourceCard({ source, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(source)}
      className="group w-full surface-dark-soft p-4 text-left transition hover:border-[rgba(200,255,87,0.3)] hover:bg-[color:var(--surface-dark-elevated)]"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[color:var(--on-dark)]">
            {source.source_id}
          </p>
          <p className="mt-1 text-xs text-[color:var(--on-dark-soft)]">
            {source.title || source.url || "Unnamed source"}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-[color:var(--primary)] transition group-hover:translate-x-1" />
      </div>
      <div className="mt-3 grid gap-2 text-xs text-[color:var(--on-dark-soft)] sm:grid-cols-2">
        <span>Section: {source.section || "Unknown"}</span>
        <span>Rerank: {source.rerank_score?.toFixed(2) ?? "—"}</span>
      </div>
    </button>
  );
}

export default SourceCard;
