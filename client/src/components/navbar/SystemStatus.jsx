import { BatteryCharging, CheckCircle2 } from "lucide-react";

function SystemStatus({ status }) {
  const isHealthy = status === "healthy";

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 shadow-sm shadow-cyan-500/5">
      <span
        className={`inline-flex h-2.5 w-2.5 rounded-full ${isHealthy ? "bg-emerald-400" : "bg-amber-400"}`}
      />
      <span>{isHealthy ? "System Healthy" : "Health warning"}</span>
      <BatteryCharging className="h-4 w-4 text-cyan-400" />
    </div>
  );
}

export default SystemStatus;
