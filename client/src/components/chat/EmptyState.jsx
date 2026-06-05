import { Sparkles, PlusCircle } from "lucide-react";

function EmptyState({ onNewChat }) {
  return (
    <div className="surface-page flex min-h-[50vh] flex-col items-center justify-center gap-6 p-10 text-center">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl border border-[color:rgba(201,119,92,0.2)] bg-[rgba(201,119,92,0.12)] text-[color:var(--primary)]">
        <Sparkles className="h-8 w-8" />
      </div>
      <div className="max-w-xl space-y-4">
        <h2 className="text-surface-title text-3xl font-semibold sm:text-4xl">
          Your AI workspace is ready.
        </h2>
        <p className="text-surface-copy text-sm leading-7 sm:text-base">
          Start a conversation with the knowledge base, ingest a website, or use
          a quick prompt to explore private retrieval.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onNewChat}
          className="button-primary px-5 py-3"
        >
          <PlusCircle className="h-4 w-4" />
          New conversation
        </button>
      </div>
    </div>
  );
}

export default EmptyState;
