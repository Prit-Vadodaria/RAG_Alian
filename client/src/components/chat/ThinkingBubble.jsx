import { Loader2 } from "lucide-react";

function ThinkingBubble({ message }) {
  return (
    <div className="animate-pulse rounded-3xl border border-dashed border-cyan-500/30 bg-zinc-950 px-5 py-6 shadow-sm shadow-cyan-500/5">
      <div className="mb-3 flex items-center gap-3 text-sm font-semibold text-cyan-300">
        <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
        <span>Assistant is thinking...</span>
      </div>
      <p className="text-sm text-zinc-400">{message}</p>
    </div>
  );
}

export default ThinkingBubble;
