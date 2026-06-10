function UsageProgressBar({ tokensUsed, dailyLimit, warningLevel }) {
  const safeLimit = Math.max(0, Number(dailyLimit) || 0);
  const safeUsed = Math.max(0, Number(tokensUsed) || 0);
  const pct = safeLimit > 0 ? Math.min(100, (safeUsed / safeLimit) * 100) : 0;
  const displayStatus = {
    none: "active",
    warning: "warning",
    critical: "critical",
    exceeded: "exceeded",
  }[warningLevel] || "active";
  const colorMap = {
    none: "bg-[color:var(--success)]",
    warning: "bg-[color:var(--warning)]",
    critical: "bg-[color:var(--primary)]",
    exceeded: "bg-[color:var(--error)]",
  };

  return (
    <div className="surface-page p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-kicker">Today's usage</p>
          <p className="mt-2 text-sm text-[color:var(--on-dark-soft)]">
            {safeUsed.toLocaleString()} of {safeLimit.toLocaleString()} tokens used
          </p>
        </div>
        <p className="text-sm font-semibold text-[color:var(--on-dark)]">
          {pct.toFixed(1)}%
        </p>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorMap[warningLevel] || colorMap.none}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-[color:var(--on-dark-soft)]">
        <span>
          Status:{" "}
          <span className="font-semibold text-[color:var(--on-dark)]">
            {displayStatus}
          </span>
        </span>
        <span>{Math.max(0, safeLimit - safeUsed).toLocaleString()} remaining</span>
      </div>
    </div>
  );
}

export default UsageProgressBar;
