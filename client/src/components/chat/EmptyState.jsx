import { Sparkles } from "lucide-react";

function EmptyState() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-3xl border border-zinc-800 bg-zinc-900 px-8 py-12 text-center shadow-sm shadow-cyan-500/5">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-500/10 text-cyan-300">
        <Sparkles className="h-8 w-8" />
      </div>
      <div>
        <h2 className="text-2xl font-semibold text-zinc-100">
          Ready for a grounded query
        </h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-zinc-400">
          Start a new conversation and explore the private knowledge base with
          context-aware, confidence-scored answers.
        </p>
      </div>
    </div>
  );
}

export default EmptyState;
