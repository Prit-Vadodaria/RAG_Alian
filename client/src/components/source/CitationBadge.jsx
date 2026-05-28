function CitationBadge({ label }) {
  return (
    <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
      {label}
    </span>
  );
}

export default CitationBadge;
