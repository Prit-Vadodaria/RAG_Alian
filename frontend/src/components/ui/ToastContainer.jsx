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
    info: "border-[rgba(200,255,87,0.24)] bg-[rgba(200,255,87,0.08)] text-[color:var(--ink)]",
    success: "border-[rgba(200,255,87,0.24)] bg-[rgba(200,255,87,0.08)] text-[color:var(--ink)]",
    error: "border-[rgba(248,113,113,0.24)] bg-[rgba(248,113,113,0.10)] text-[color:var(--ink)]",
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4 sm:justify-end">
      <div
        className={`pointer-events-auto max-w-md rounded-[1.5rem] border px-4 py-3 shadow-xl backdrop-blur-sm ${
          variantStyles[toastType] || variantStyles.info
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 text-sm leading-6">{toastMessage}</div>
          <button
            type="button"
            onClick={clearToast}
            className="text-xs text-[color:var(--muted)] transition hover:text-[color:var(--ink)]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
