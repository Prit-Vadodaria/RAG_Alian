import { useEffect, useMemo, useState, useRef } from "react";
import { useContextStore } from "../../store/contextStore";
import ConfirmDialog from "../ui/ConfirmDialog";

function isReadyContext(context) {
  const status = (context?.status || "").toLowerCase();
  return status === "ready";
}

export default function ContextSelector() {
  const {
    contexts,
    selectedContext,
    fetchContexts,
    setSelectedContext,
    removeContext,
    showToast,
  } = useContextStore();
  const [open, setOpen] = useState(false);
  const [confirmContext, setConfirmContext] = useState(null);
  const [deletingContextId, setDeletingContextId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    fetchContexts();
    const interval = setInterval(() => {
      fetchContexts();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchContexts]);

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, []);

  const readyContexts = useMemo(
    () => contexts.filter(isReadyContext),
    [contexts],
  );

  useEffect(() => {
    if (!readyContexts.some((c) => c.id === selectedContext)) {
      const fallback =
        readyContexts.find((c) => c.id === "alian_default")?.id ||
        readyContexts[0]?.id ||
        "alian_default";
      setSelectedContext(fallback);
    }
  }, [readyContexts, selectedContext, setSelectedContext]);

  const current = readyContexts.find((c) => c.id === selectedContext) ||
    readyContexts.find((c) => c.id === "alian_default") || {
      name: "Alian Software",
    };

  return (
    <div className="relative w-full" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center justify-between gap-2 rounded-2xl border border-cyan-500 bg-cyan-500/5 px-3 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-400"
      >
        <span className="truncate">{current.name}</span>
        <span className="text-xs text-zinc-400">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-2 max-h-64 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900 p-2 shadow-lg">
          {deleteError && (
            <div className="mb-2 rounded border border-red-600 bg-red-600/10 px-3 py-2 text-sm text-red-200">
              {deleteError}
            </div>
          )}
          {readyContexts.length === 0 && (
            <div className="px-2 py-2 text-sm text-zinc-400">
              No ready contexts
            </div>
          )}
          {readyContexts.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-2 rounded px-2 py-2 hover:bg-zinc-800"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{c.name}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <button
                  onClick={() => {
                    setSelectedContext(c.id);
                    setOpen(false);
                  }}
                  disabled={deletingContextId === c.id}
                  className={`px-2 py-1 rounded text-sm bg-zinc-800 ${
                    deletingContextId === c.id
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  Select
                </button>
                {c.isDeletable && (
                  <button
                    onClick={() => setConfirmContext(c)}
                    disabled={deletingContextId === c.id}
                    className={`px-2 py-1 rounded text-sm ${
                      deletingContextId === c.id
                        ? "bg-red-600/60 opacity-50 cursor-not-allowed"
                        : "bg-red-600"
                    }`}
                  >
                    {deletingContextId === c.id ? "Deleting..." : "Delete"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(confirmContext)}
        title="Confirm delete"
        description={
          confirmContext
            ? `Delete context '${confirmContext.name}'? This cannot be undone.`
            : ""
        }
        confirmText="Delete"
        cancelText="Cancel"
        loading={deletingContextId === confirmContext?.id}
        onConfirm={async () => {
          if (!confirmContext) return;
          setDeleteError(null);
          setDeletingContextId(confirmContext.id);
          try {
            await removeContext(confirmContext.id);
            await fetchContexts();
            showToast(`Deleted context '${confirmContext.name}'.`, "success");
            setOpen(false);
            setConfirmContext(null);
          } catch (err) {
            console.error("Failed to delete context", err);
            setDeleteError(err?.message || String(err));
          } finally {
            setDeletingContextId(null);
          }
        }}
        onCancel={() => setConfirmContext(null)}
      />
    </div>
  );
}
