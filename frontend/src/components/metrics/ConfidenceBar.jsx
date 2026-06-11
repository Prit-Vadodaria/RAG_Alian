function ConfidenceBar({ label, value, colorClass }) {
  const width = Math.min(100, Math.max(0, Math.round(value * 100)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-[color:var(--muted)]">
        <span>{label}</span>
        <span>{width}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[color:var(--surface-2)]">
        <div
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export default ConfidenceBar;
