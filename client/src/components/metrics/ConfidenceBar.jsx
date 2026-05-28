function ConfidenceBar({ label, value, colorClass }) {
  const width = Math.min(100, Math.max(0, Math.round(value * 100)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <span>{width}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export default ConfidenceBar;
