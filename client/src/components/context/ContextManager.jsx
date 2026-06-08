import { useEffect, useState } from "react";
import { Globe, Loader2, Pause, Play, Plus, Trash2 } from "lucide-react";
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
    pauseContext,
    resumeContext,
    showToast,
  } = useContextStore();

  const [url, setUrl] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
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
    const chunkOverlapTokens = Number.parseInt(String(chunking.chunkOverlapTokens), 10);

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
      showToast("Context added.", "success");
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

  const handlePause = async (context) => {
    setUpdatingId(context.id);
    setSubmitError(null);
    try {
      await pauseContext(context.id);
      await fetchContexts();
      showToast(`Paused context '${context.name}'.`, "success");
    } catch (err) {
      setSubmitError(err.message || String(err));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleResume = async (context) => {
    setUpdatingId(context.id);
    setSubmitError(null);
    try {
      await resumeContext(context.id);
      await fetchContexts();
      showToast(`Resumed context '${context.name}'.`, "success");
    } catch (err) {
      setSubmitError(err.message || String(err));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={handleAdd} className="surface-page p-5">
        <div className="flex items-center gap-3 text-[color:var(--primary)]">
          <Globe className="h-5 w-5" />
          <p className="text-sm font-semibold text-[color:var(--ink)]">
            Add website context
          </p>
        </div>
        <p className="mt-2 text-sm text-[color:var(--body)]">
          Ingest a new site into an isolated workspace. Chat stays available while
          ingestion runs in the background.
        </p>
        <div className="mt-4">
          <p className="text-kicker">Chunking configuration</p>
          <p className="mt-2 text-sm text-[color:var(--body)]">
            Controls how website content is split before embeddings are generated.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="space-y-2">
              <span className="block text-sm text-[color:var(--body)]">
                Max Chunk Tokens
              </span>
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
                className="field"
                disabled={isSubmitting}
              />
            </label>
            <label className="space-y-2">
              <span className="block text-sm text-[color:var(--body)]">
                Min Chunk Tokens
              </span>
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
                className="field"
                disabled={isSubmitting}
              />
            </label>
            <label className="space-y-2">
              <span className="block text-sm text-[color:var(--body)]">
                Chunk Overlap
              </span>
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
                className="field"
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
            className="field flex-1"
            disabled={isSubmitting}
          />
          <button
            type="submit"
            disabled={isSubmitting || !url.trim()}
            className="button-primary"
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
          <p className="mt-3 text-sm text-[color:var(--error)]">
            {submitError || error}
          </p>
        )}
      </form>

      <div className="surface-page p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[color:var(--ink)]">
            Registered contexts
          </p>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-[color:var(--muted)]" />}
        </div>
        <p className="mt-1 text-xs text-[color:var(--muted)]">Refreshes every 5 seconds</p>

        <div className="mt-4 space-y-3">
          {contexts.length === 0 && (
            <p className="text-sm text-[color:var(--body)]">No contexts registered yet.</p>
          )}
          {contexts.map((context) => (
            <div
              key={context.id}
              className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium text-[color:var(--ink)]">
                    {context.name}
                  </p>
                  <ContextStatusBadge status={context.status} />
                  {context.isDefault && (
                    <span className="text-xs text-[color:var(--muted)]">default</span>
                  )}
                </div>
                <p className="mt-1 truncate text-xs text-[color:var(--muted)]">
                  {context.id}
                </p>
                {context.seed_url && (
                  <p className="mt-1 truncate text-xs text-[color:var(--primary-strong)]">
                    {context.seed_url}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handlePause(context)}
                  disabled={
                    updatingId === context.id ||
                    !["discovering", "processing_batch"].includes(String(context.status || "").toLowerCase())
                  }
                  className="button-secondary px-3 py-2 text-xs"
                >
                  {updatingId === context.id && ["discovering", "processing_batch"].includes(String(context.status || "").toLowerCase()) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Pause className="h-4 w-4" />
                  )}
                  Pause
                </button>
                <button
                  type="button"
                  onClick={() => handleResume(context)}
                  disabled={
                    updatingId === context.id ||
                    String(context.status || "").toLowerCase() !== "paused"
                  }
                  className="button-secondary px-3 py-2 text-xs"
                >
                  {updatingId === context.id && String(context.status || "").toLowerCase() === "paused" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Resume
                </button>
                {context.isDeletable && (
                  <button
                    type="button"
                    onClick={() => handleDelete(context)}
                    disabled={
                      deletingId === context.id || context.status === "deleting"
                    }
                    className="button-danger px-3 py-2 text-xs"
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
