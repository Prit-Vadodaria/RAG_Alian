import { formatDuration } from "../../utils/format";

function LatencyBadge({ value }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-200">
      <span className="text-cyan-300">Response Time:</span>
      <span className="font-semibold text-zinc-100">
        {formatDuration(value)}
      </span>
    </div>
  );
}

export default LatencyBadge;
