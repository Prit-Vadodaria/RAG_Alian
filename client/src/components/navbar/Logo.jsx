function Logo() {
  return (
    <div className="flex items-center gap-3 text-cyan-400">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-500 bg-zinc-900 text-lg font-semibold text-cyan-300 shadow-sm shadow-cyan-500/20">
        R
      </div>
      <div>
        <p className="text-sm uppercase tracking-[0.32em] text-zinc-400">
          RAG Workspace
        </p>
        <p className="text-base font-semibold text-zinc-100">
          Enterprise Assistant
        </p>
      </div>
    </div>
  );
}

export default Logo;
