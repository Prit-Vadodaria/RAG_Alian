const STATUS_STYLES = {
  ready: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  ingesting: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  processing: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  deleting: "border-orange-500/40 bg-orange-500/10 text-orange-200",
  failed: "border-red-500/40 bg-red-500/10 text-red-300",
};

export default function ContextStatusBadge({ status }) {
  const normalized = (status || "ready").toLowerCase();
  const style = STATUS_STYLES[normalized] || "border-zinc-700 bg-zinc-800 text-zinc-300";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${style}`}
    >
      {normalized}
    </span>
  );
}
