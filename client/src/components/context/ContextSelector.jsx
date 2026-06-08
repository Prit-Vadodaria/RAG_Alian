import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useContextStore } from "../../store/contextStore";

function isReadyContext(context) {
  const status = (context?.status || "").toLowerCase();
  return status === "ready" || status === "partially_ready";
}

export default function ContextSelector() {
  const { contexts, selectedContext, fetchContexts, setSelectedContext } =
    useContextStore();
  const [open, setOpen] = useState(false);
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
      setSelectedContext(readyContexts[0]?.id || "");
    }
  }, [readyContexts, selectedContext, setSelectedContext]);

  const current =
    readyContexts.find((c) => c.id === selectedContext) || {
      name: "Select context",
    };

  const handleSelect = (contextId) => {
    setSelectedContext(contextId);
    setOpen(false);
  };

  return (
    <div className="relative w-full" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className={`button-secondary flex w-full items-center justify-between gap-2 px-3 py-2 text-sm ${
          open ? "rounded-b-none border-b-0" : ""
        }`}
      >
        <span className="truncate">{current.name}</span>
        {open ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {open && (
        <div className="-mt-px absolute left-0 right-0 z-50 max-h-72 overflow-y-auto rounded-t-none rounded-b-[0.5rem] surface-dark-elevated p-2">
          {readyContexts.length === 0 && (
            <div className="px-2 py-3 text-sm text-[color:var(--on-dark-soft)]">
              No ready contexts
            </div>
          )}
          {readyContexts.map((c) => {
            const active = c.id === selectedContext;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                  active
                    ? "bg-[color:var(--surface-dark-soft)] text-[color:var(--on-dark)]"
                    : "text-[color:var(--on-dark-soft)] hover:bg-[color:var(--surface-dark-soft)] hover:text-[color:var(--on-dark)]"
                }`}
              >
                <span className="min-w-0 truncate">{c.name}</span>
                {active ? (
                  <span className="token-pill shrink-0">Selected</span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
