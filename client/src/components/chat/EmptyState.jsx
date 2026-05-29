import { Sparkles, PlusCircle } from "lucide-react";

function EmptyState({ onNewChat }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 rounded-[2rem] border border-zinc-800 bg-[#111317] p-10 text-center shadow-[0_32px_70px_rgba(15,23,42,0.3)]">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-500/10 text-cyan-300">
        <Sparkles className="h-8 w-8" />
      </div>
      <div className="max-w-xl space-y-4">
        <h2 className="text-3xl font-semibold text-zinc-100 sm:text-4xl">
          Your AI workspace is ready.
        </h2>
        <p className="text-sm leading-7 text-zinc-400 sm:text-base">
          Start a conversation with the knowledge base, ingest a website, or use
          a quick prompt to explore private retrieval.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onNewChat}
          className="inline-flex items-center justify-center gap-2 rounded-3xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
        >
          <PlusCircle className="h-4 w-4" />
          New conversation
        </button>
      </div>
    </div>
  );
}

export default EmptyState;
