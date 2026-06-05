import { formatDuration } from "../../utils/format";

function LatencyBadge({ value }) {
  return (
    <div className="token-pill inline-flex items-center gap-2 px-4 py-3 text-sm">
      <span className="text-[color:var(--primary-strong)]">Response Time:</span>
      <span className="font-semibold text-[color:var(--ink)]">
        {formatDuration(value)}
      </span>
    </div>
  );
}

export default LatencyBadge;
