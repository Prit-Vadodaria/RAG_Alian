function CitationBadge({ label, onClick }) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300 transition hover:border-cyan-400 hover:text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
      >
        {label}
      </button>
    );
  }

  return (
    <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
      {label}
    </span>
  );
}

export default CitationBadge;
