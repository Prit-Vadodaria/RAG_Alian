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
    <div className="flex flex-col gap-2 rounded border border-zinc-800 p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium truncate">{context.name}</div>
          <div className="text-xs text-zinc-400 truncate">
            {context.status || "ready"}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => setSelectedContext(context.id)}
            disabled={isDeleting}
            className={`px-2 py-1 rounded text-sm bg-zinc-800 ${
              isDeleting ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            Select
          </button>
          {context.isDeletable && (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={isDeleting}
              className={`px-2 py-1 rounded text-sm ${
                isDeleting
                  ? "bg-red-600/60 opacity-50 cursor-not-allowed"
                  : "bg-red-600"
              }`}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="rounded border border-red-600 bg-red-600/10 px-3 py-2 text-sm text-red-200">
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
