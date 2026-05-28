import { X } from "lucide-react";
import { formatDuration } from "../../utils/format";

function SourceDrawer({ source, onClose }) {
  if (!source) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-zinc-950/70 p-4 sm:items-center">
      <div className="w-full max-w-3xl rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/40">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">
              {source.source_id}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {source.title || source.url || "Source preview"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-800 bg-zinc-900 p-2 text-zinc-300 transition hover:border-cyan-500 hover:text-cyan-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-200">
            <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">
              Chunk text
            </p>
            <p className="mt-3 leading-7 text-zinc-300">
              {source.text || "No chunk text available."}
            </p>
          </div>
          <div className="space-y-3 rounded-3xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                Similarity
              </p>
              <p className="mt-2 text-base text-zinc-100">
                {source.similarity?.toFixed(2) ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                Rerank score
              </p>
              <p className="mt-2 text-base text-zinc-100">
                {source.rerank_score?.toFixed(2) ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                Section
              </p>
              <p className="mt-2 text-base text-zinc-100">
                {source.section || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                Page / Chunk
              </p>
              <p className="mt-2 text-base text-zinc-100">
                {source.chunk_id || "Unknown"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SourceDrawer;
