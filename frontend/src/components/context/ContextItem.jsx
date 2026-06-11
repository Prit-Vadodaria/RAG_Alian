import { useState } from "react";
import { useContextStore } from "../../store/contextStore";
import ConfirmDialog from "../ui/ConfirmDialog";

export default function ContextItem({ context }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const removeContext = useContextStore((s) => s.removeContext);
  const setSelectedContext = useContextStore((s) => s.setSelectedContext);
  const fetchContexts = useContextStore((s) => s.fetchContexts);
  const showToast = useContextStore((s) => s.showToast);

  return (
    <div className="surface-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-[color:var(--ink)]">
            {context.name}
          </div>
          <div className="mt-1 truncate text-xs text-[color:var(--muted)]">
            {context.status || "ready"}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedContext(context.id)}
            disabled={isDeleting}
            className={`button-secondary px-3 py-2 text-xs ${isDeleting ? "opacity-60" : ""}`}
          >
            Select
          </button>
          {context.isDeletable && (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={isDeleting}
              className={`button-danger px-3 py-2 text-xs ${isDeleting ? "opacity-60" : ""}`}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-3 rounded-xl border border-[color:var(--error)]/30 bg-[color:var(--error)]/10 px-3 py-2 text-sm text-[color:var(--error)]">
          {error}
        </div>
      )}
      <ConfirmDialog
        open={showConfirm}
        title="Confirm delete"
        description={`Delete context '${context.name}'? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        loading={isDeleting}
        onConfirm={async () => {
          setError(null);
          setIsDeleting(true);
          try {
            await removeContext(context.id);
            await fetchContexts();
            showToast(`Deleted context '${context.name}'.`, "success");
            setShowConfirm(false);
          } catch (err) {
            console.error("Failed to delete context", err);
            setError(err?.message || String(err));
          } finally {
            setIsDeleting(false);
          }
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
