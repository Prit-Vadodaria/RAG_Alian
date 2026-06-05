import { X } from "lucide-react";

function SourceDrawer({ source, onClose }) {
  if (!source) return null;

  return (
    <div className="drawer-overlay flex items-end justify-center p-4 sm:items-center">
      <div className="drawer-panel flex max-h-[82vh] w-full max-w-3xl flex-col overflow-hidden p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-surface-title text-xl font-semibold text-[color:var(--on-dark)]">
              {source.source_id}
            </h2>
            <p className="mt-1 text-sm text-[color:var(--on-dark-soft)]">
              {source.title || source.url || "Source preview"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="button-icon text-[color:var(--on-dark)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 gap-4 sm:grid-cols-2">
          <div className="surface-dark-soft flex min-h-0 flex-col p-4 text-sm text-[color:var(--on-dark)]">
            <p className="text-kicker text-[color:var(--on-dark-soft)]">
              Chunk text
            </p>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-2">
              <p className="leading-7 text-[color:var(--on-dark)]">
                {source.text || "No chunk text available."}
              </p>
            </div>
          </div>
          <div className="space-y-3 surface-dark-elevated p-4 text-sm text-[color:var(--on-dark)]">
            <div>
              <p className="text-kicker text-[color:var(--on-dark-soft)]">
                Similarity
              </p>
              <p className="mt-2 text-base">
                {source.similarity?.toFixed(2) ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-kicker text-[color:var(--on-dark-soft)]">
                Rerank score
              </p>
              <p className="mt-2 text-base">
                {source.rerank_score?.toFixed(2) ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-kicker text-[color:var(--on-dark-soft)]">
                Section
              </p>
              <p className="mt-2 text-base">{source.section || "N/A"}</p>
            </div>
            <div>
              <p className="text-kicker text-[color:var(--on-dark-soft)]">
                Page / Chunk
              </p>
              <p className="mt-2 text-base">{source.chunk_id || "Unknown"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SourceDrawer;
