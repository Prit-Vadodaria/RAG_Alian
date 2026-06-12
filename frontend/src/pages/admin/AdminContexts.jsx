import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

import { fetchAdminContexts } from "../../services/admin";

const STATUS_OPTIONS = [
  ["", "All"],
  ["discovering", "Queued"],
  ["processing_batch", "Processing"],
  ["partially_ready", "Partially Ready"],
  ["ready", "Completed"],
  ["paused", "Paused"],
  ["failed", "Failed"],
];

function formatDateTime(value) {
  if (!value) return "Never";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "Never";
  }
}

function AdminContexts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState({ items: [], total: 0, page: 1, limit: 25 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const query = useMemo(
    () => ({
      search: searchParams.get("search") || "",
      status: searchParams.get("status") || "",
      sortBy: searchParams.get("sortBy") || "created_at",
      sortDir: searchParams.get("sortDir") || "desc",
      page: Number(searchParams.get("page") || 1),
      limit: Number(searchParams.get("limit") || 25),
    }),
    [searchParams],
  );

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setLoading(true);
      fetchAdminContexts(query)
        .then((result) => {
          if (!active) return;
          setData(result || { items: [], total: 0, page: 1, limit: 25 });
          setError("");
        })
        .catch((err) => {
          if (!active) return;
          setError(err.message || String(err));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    });
    return () => {
      active = false;
    };
  }, [query]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value === "" || value == null) next.delete(key);
    else next.set(key, String(value));
    if (key !== "page") next.set("page", "1");
    setSearchParams(next);
  };

  const toggleSort = (key) => {
    const currentKey = query.sortBy;
    const nextDir = currentKey === key && query.sortDir === "asc" ? "desc" : "asc";
    const next = new URLSearchParams(searchParams);
    next.set("sortBy", key);
    next.set("sortDir", nextDir);
    setSearchParams(next);
  };

  const totalPages = Math.max(1, Math.ceil((data.total || 0) / (data.limit || 25)));

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1 pb-2">
      <header className="surface-page p-5">
        <p className="text-kicker">Admin visibility</p>
        <h1 className="mt-3 text-3xl font-semibold text-[color:var(--on-dark)]">Web Contexts</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--on-dark-soft)]">
          Search and review every website context across all clients.
        </p>
      </header>

      <section className="surface-page p-4">
        <div className="grid gap-3 md:grid-cols-[1.5fr_0.8fr_auto]">
          <input
            className="field"
            placeholder="Search by context, client, or URL"
            value={query.search}
            onChange={(event) => setParam("search", event.target.value)}
          />
          <select
            className="field"
            value={query.status}
            onChange={(event) => setParam("status", event.target.value)}
          >
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value || "all"} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setSearchParams(new URLSearchParams())} className="button-secondary">
            <RefreshCw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </section>

      {loading ? <div className="surface-page p-4 text-sm text-[color:var(--on-dark-soft)]">Loading contexts...</div> : null}
      {error ? <div className="surface-page border border-[color:var(--error)]/30 p-4 text-sm text-[color:var(--error)]">{error}</div> : null}

      <div className="surface-page overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-center text-sm">
            <thead className="bg-[color:var(--surface-dark-soft)] text-[color:var(--on-dark-soft)]">
              <tr>
                {[
                  ["id", "Context ID"],
                  ["name", "Name"],
                  ["client_name", "Client"],
                  ["seed_url", "URL"],
                  ["status", "Status"],
                  ["created_at", "Created"],
                  ["last_accessed_at", "Last Accessed"],
                ].map(([key, label]) => (
                  <th key={key} className="px-4 py-3">
                    <button type="button" onClick={() => toggleSort(key)} className="mx-auto flex items-center gap-1 font-semibold">
                      {label}
                      {query.sortBy === key ? (query.sortDir === "asc" ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />) : null}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items?.map((item) => (
                <tr key={item.id} className="border-t border-[var(--hairline)]">
                  <td className="px-4 py-3 font-medium text-[color:var(--on-dark)]">{item.id}</td>
                  <td className="px-4 py-3 text-[color:var(--on-dark-soft)]">{item.name}</td>
                  <td className="px-4 py-3 text-[color:var(--on-dark-soft)]">
                    <div className="flex flex-col items-center">
                      <span>{item.client_name || "Unknown"}</span>
                      <span className="text-xs text-[color:var(--on-dark-soft)]">{item.client_id || "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[color:var(--on-dark-soft)]">{item.seed_url}</td>
                  <td className="px-4 py-3">
                    <span
                      className="token-pill admin-status-badge border mx-auto"
                      data-status={String(item.status || "unknown").toLowerCase()}
                    >
                      {item.status || "unknown"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[color:var(--on-dark-soft)]">{formatDateTime(item.created_at)}</td>
                  <td className="px-4 py-3 text-[color:var(--on-dark-soft)]">{formatDateTime(item.last_accessed_at)}</td>
                </tr>
              ))}
              {!loading && (data.items?.length || 0) === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-[color:var(--on-dark-soft)]" colSpan={7}>
                    No contexts found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 surface-page p-4">
        <p className="text-sm text-[color:var(--on-dark-soft)]">
          Page {data.page} of {totalPages} · {data.total} total
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="button-secondary px-3 py-2"
            disabled={data.page <= 1}
            onClick={() => setParam("page", Math.max(1, (data.page || 1) - 1))}
          >
            Prev
          </button>
          <button
            type="button"
            className="button-secondary px-3 py-2"
            disabled={data.page >= totalPages}
            onClick={() => setParam("page", Math.min(totalPages, (data.page || 1) + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminContexts;
