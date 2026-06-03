import { useEffect, useState } from "react";
import { Globe, Loader2, Plus, Trash2 } from "lucide-react";
import { useContextStore } from "../../store/contextStore";
import ContextStatusBadge from "./ContextStatusBadge";
import ConfirmDialog from "../ui/ConfirmDialog";
import contextApi from "../../services/context";

const FALLBACK_CHUNKING = {
  maxChunkTokens: 350,
  minChunkTokens: 80,
  chunkOverlapTokens: 60,
};

export default function ContextManager() {
  const {
    contexts,
    loading,
    error,
    fetchContexts,
    addContext,
    removeContext,
    showToast,
  } = useContextStore();

  const [url, setUrl] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmContext, setConfirmContext] = useState(null);
  const [chunkingDefaults, setChunkingDefaults] = useState(FALLBACK_CHUNKING);
  const [chunking, setChunking] = useState(FALLBACK_CHUNKING);

  useEffect(() => {
    fetchContexts();
    contextApi
      .getContextDefaults()
      .then((data) => {
        const next = {
          ...FALLBACK_CHUNKING,
          ...(data?.chunking || {}),
        };
        setChunkingDefaults(next);
        setChunking((current) => ({
          maxChunkTokens: current.maxChunkTokens ?? next.maxChunkTokens,
          minChunkTokens: current.minChunkTokens ?? next.minChunkTokens,
          chunkOverlapTokens:
            current.chunkOverlapTokens ?? next.chunkOverlapTokens,
        }));
      })
      .catch(() => {
        setChunkingDefaults(FALLBACK_CHUNKING);
      });
    const interval = setInterval(() => {
      fetchContexts();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchContexts]);

  const handleAdd = async (event) => {
    event.preventDefault();
    setSubmitError(null);

    const maxChunkTokens = Number.parseInt(String(chunking.maxChunkTokens), 10);
    const minChunkTokens = Number.parseInt(String(chunking.minChunkTokens), 10);
    const chunkOverlapTokens = Number.parseInt(
      String(chunking.chunkOverlapTokens),
      10,
    );

    if (!Number.isFinite(maxChunkTokens) || maxChunkTokens < 100) {
      setSubmitError("Max Chunk Tokens must be at least 100.");
      return;
    }
    if (!Number.isFinite(minChunkTokens) || minChunkTokens < 20) {
      setSubmitError("Min Chunk Tokens must be at least 20.");
      return;
    }
    if (minChunkTokens >= maxChunkTokens) {
      setSubmitError("Min Chunk Tokens must be smaller than Max Chunk Tokens.");
      return;
    }
    if (!Number.isFinite(chunkOverlapTokens) || chunkOverlapTokens < 0) {
      setSubmitError("Chunk Overlap must be zero or greater.");
      return;
    }
    if (chunkOverlapTokens >= maxChunkTokens) {
      setSubmitError("Chunk Overlap must be smaller than Max Chunk Tokens.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addContext(url.trim(), {
        chunking: {
          maxChunkTokens,
          minChunkTokens,
          chunkOverlapTokens,
        },
      });
      setUrl("");
      setChunking(chunkingDefaults);
      await fetchContexts();
    } catch (err) {
      setSubmitError(err.message || String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (context) => {
    setConfirmContext(context);
  };

  const handleConfirmDelete = async () => {
    if (!confirmContext) return;
    setDeletingId(confirmContext.id);
    setSubmitError(null);
    try {
      await removeContext(confirmContext.id);
      await fetchContexts();
      showToast(`Deleted context '${confirmContext.name}'.`, "success");
      setConfirmContext(null);
    } catch (err) {
      setSubmitError(err.message || String(err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <form
        onSubmit={handleAdd}
        className="rounded-[1.75rem] border border-zinc-800 bg-[#0f1116] p-5"
      >
        <div className="flex items-center gap-3 text-cyan-400">
          <Globe className="h-5 w-5" />
          <p className="font-semibold text-zinc-100">Add website context</p>
        </div>
        <p className="mt-2 text-sm text-zinc-400">
          Ingest a new site into an isolated workspace. Chat stays available
          while ingestion runs in the background.
        </p>
        <div className="mt-4">
          <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">
            Chunking configuration
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            Controls how website content is split before embeddings are generated.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="space-y-2">
              <span className="block text-sm text-zinc-300">Max Chunk Tokens</span>
              <input
                type="number"
                min="100"
                value={chunking.maxChunkTokens}
                onChange={(event) =>
                  setChunking((current) => ({
                    ...current,
                    maxChunkTokens: event.target.value,
                  }))
                }
                placeholder={String(chunkingDefaults.maxChunkTokens)}
                className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-500"
                disabled={isSubmitting}
              />
            </label>
            <label className="space-y-2">
              <span className="block text-sm text-zinc-300">Min Chunk Tokens</span>
              <input
                type="number"
                min="20"
                value={chunking.minChunkTokens}
                onChange={(event) =>
                  setChunking((current) => ({
                    ...current,
                    minChunkTokens: event.target.value,
                  }))
                }
                placeholder={String(chunkingDefaults.minChunkTokens)}
                className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-500"
                disabled={isSubmitting}
              />
            </label>
            <label className="space-y-2">
              <span className="block text-sm text-zinc-300">Chunk Overlap</span>
              <input
                type="number"
                min="0"
                value={chunking.chunkOverlapTokens}
                onChange={(event) =>
                  setChunking((current) => ({
                    ...current,
                    chunkOverlapTokens: event.target.value,
                  }))
                }
                placeholder={String(chunkingDefaults.chunkOverlapTokens)}
                className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-500"
                disabled={isSubmitting}
              />
            </label>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com"
            className="flex-1 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-cyan-500"
            disabled={isSubmitting}
          />
          <button
            type="submit"
            disabled={isSubmitting || !url.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add context
          </button>
        </div>
        {(submitError || error) && (
          <p className="mt-3 text-sm text-red-400">{submitError || error}</p>
        )}
      </form>

      <div className="rounded-[1.75rem] border border-zinc-800 bg-[#0f1116] p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold text-zinc-100">Registered contexts</p>
          {loading && (
            <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
          )}
        </div>
        <p className="mt-1 text-xs text-zinc-500">Refreshes every 5 seconds</p>

        <div className="mt-4 space-y-3">
          {contexts.length === 0 && (
            <p className="text-sm text-zinc-400">No contexts registered yet.</p>
          )}
          {contexts.map((context) => (
            <div
              key={context.id}
              className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium text-zinc-100">
                    {context.name}
                  </p>
                  <ContextStatusBadge status={context.status} />
                  {context.isDefault && (
                    <span className="text-xs text-zinc-500">default</span>
                  )}
                </div>
                <p className="mt-1 truncate text-xs text-zinc-500">
                  {context.id}
                </p>
                {context.seed_url && (
                  <p className="mt-1 truncate text-xs text-cyan-400/80">
                    {context.seed_url}
                  </p>
                )}
              </div>
              {context.isDeletable && (
                <button
                  type="button"
                  onClick={() => handleDelete(context)}
                  disabled={
                    deletingId === context.id || context.status === "deleting"
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingId === context.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      <ConfirmDialog
        open={Boolean(confirmContext)}
        title="Confirm delete"
        description={
          confirmContext
            ? `Delete context '${confirmContext.name}'? Crawled data under this website will be removed.`
            : ""
        }
        confirmText="Delete"
        cancelText="Cancel"
        loading={deletingId === confirmContext?.id}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmContext(null)}
      />
    </div>
  );
}
