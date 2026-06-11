import { formatDuration } from "../../utils/format";

function RetrievalStats({ latency }) {
  const formatTokenCount = (value) => Number(value || 0).toLocaleString();
  const formatThroughput = (value) => `${Number(value || 0).toFixed(2)} tok/s`;

  return (
    <div className="space-y-3 surface-card p-4 text-sm text-[color:var(--body)]">
      <div className="flex items-center justify-between text-[color:var(--muted)]">
        <span>Retrieval latency</span>
        <span>
          {formatDuration(latency?.retrieval || latency?.retrieval_ms)}
        </span>
      </div>
      <div className="flex items-center justify-between text-[color:var(--muted)]">
        <span>Rerank latency</span>
        <span>{formatDuration(latency?.rerank || latency?.rerank_latency_ms)}</span>
      </div>
      <div className="flex items-center justify-between text-[color:var(--muted)]">
        <span>Generation latency</span>
        <span>
          {formatDuration(
            latency?.generation || latency?.generation_latency_ms,
          )}
        </span>
      </div>
      <div className="flex items-center justify-between text-[color:var(--muted)]">
        <span>Input tokens</span>
        <span>{formatTokenCount(latency?.inputTokens || latency?.input_tokens)}</span>
      </div>
      <div className="flex items-center justify-between text-[color:var(--muted)]">
        <span>Output tokens</span>
        <span>{formatTokenCount(latency?.outputTokens || latency?.output_tokens)}</span>
      </div>
      <div className="flex items-center justify-between text-[color:var(--muted)]">
        <span>Total tokens</span>
        <span>{formatTokenCount(latency?.totalTokens || latency?.total_tokens)}</span>
      </div>
      <div className="flex items-center justify-between text-[color:var(--muted)]">
        <span>Throughput</span>
        <span>
          {formatThroughput(
            latency?.throughput || latency?.throughput_tokens_per_second,
          )}
        </span>
      </div>
    </div>
  );
}

export default RetrievalStats;
