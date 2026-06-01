import { useEffect } from "react";
import { useContextStore } from "../../store/contextStore";

export default function ToastContainer() {
  const toastMessage = useContextStore((state) => state.toastMessage);
  const toastType = useContextStore((state) => state.toastType);
  const clearToast = useContextStore((state) => state.clearToast);

  useEffect(() => {
    if (!toastMessage) return undefined;
    const timer = window.setTimeout(clearToast, 4500);
    return () => window.clearTimeout(timer);
  }, [toastMessage, clearToast]);

  if (!toastMessage) return null;

  const variantStyles = {
    info: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    error: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4 sm:justify-end">
      <div
        className={`pointer-events-auto max-w-md rounded-3xl border px-4 py-3 shadow-xl backdrop-blur-sm ${
          variantStyles[toastType] || variantStyles.info
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 text-sm leading-6">{toastMessage}</div>
          <button
            type="button"
            onClick={clearToast}
            className="text-xs text-zinc-400 transition hover:text-zinc-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
