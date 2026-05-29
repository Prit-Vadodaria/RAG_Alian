import { useState, useEffect } from "react";
import { useContextStore } from "../../store/contextStore";

export default function AddContextModal({ onClose }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [polling, setPolling] = useState(false);

  const addContext = useContextStore((s) => s.addContext);
  const refreshContext = useContextStore((s) => s.refreshContext);
  const setContextStatus = useContextStore((s) => s.setContextStatus);

  useEffect(() => {
    let interval = null;
    if (polling && status && status.contextId) {
      interval = setInterval(async () => {
        const info = await refreshContext(status.contextId);
        if (info && (info.status === "ready" || info.status === "failed")) {
          setContextStatus(
            status.contextId,
            info.status,
            info.logPreview || null,
          );
          setPolling(false);
          clearInterval(interval);
          onClose?.();
        }
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [polling, status, refreshContext, setContextStatus, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const data = await addContext(url);
      const id = data.contextId || data.id;
      setStatus({ contextId: id });
      setPolling(true);
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  return (
    <div className="fixed left-0 top-0 z-50 flex h-full w-full items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded bg-zinc-900 p-6">
        <h3 className="mb-4 text-lg font-semibold">Add Website Context</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full rounded px-3 py-2 bg-zinc-800 border border-zinc-700"
          />
          {error && <div className="text-sm text-red-400">{error}</div>}
          {polling && (
            <div className="text-sm text-zinc-300">
              Ingestion in progress... polling status every 3s
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-zinc-800 px-3 py-1"
            >
              Cancel
            </button>
            <button className="rounded bg-cyan-600 px-3 py-1">Add</button>
          </div>
        </form>
      </div>
    </div>
  );
}
