import { formatDuration } from "../../utils/format";

function RetrievalStats({ latency }) {
  return (
    <div className="space-y-3 rounded-3xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-200">
      <div className="flex items-center justify-between text-zinc-400">
        <span>Retrieval latency</span>
        <span>
          {formatDuration(latency?.retrieval || latency?.retrieval_ms)}
        </span>
      </div>
      <div className="flex items-center justify-between text-zinc-400">
        <span>Generation latency</span>
        <span>
          {formatDuration(
            latency?.generation || latency?.generation_latency_ms,
          )}
        </span>
      </div>
    </div>
  );
}

export default RetrievalStats;
