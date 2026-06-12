import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { deleteClient, listClients, updateClient } from "../../services/admin";

function AdminClients() {
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyClientId, setBusyClientId] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ page: 1, totalPages: 1, totalItems: 0, limit: 25 });

  const refresh = async () => {
    try {
      setLoading(true);
      const result = await listClients({
        search,
        status,
        page,
        limit: pageInfo.limit,
      });
      setClients(result.items || []);
      setPageInfo((current) => ({
        ...current,
        page: result.page || 1,
        totalPages: result.totalPages || 1,
        totalItems: result.totalItems || 0,
        limit: result.limit || current.limit,
      }));
      setError("");
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [search, status, page]);

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  const statusOptions = useMemo(
    () => [
      { label: "All statuses", value: "all" },
      { label: "Active", value: "active" },
      { label: "Disabled", value: "disabled" },
    ],
    [],
  );

  const toggleStatus = async (client) => {
    setBusyClientId(client.id);
    try {
      await updateClient(client.id, {
        status: client.status === "active" ? "disabled" : "active",
      });
      await refresh();
    } finally {
      setBusyClientId("");
    }
  };

  const remove = async (client) => {
    if (!window.confirm(`Delete ${client.name}? This permanently removes their contexts, chatbots, and usage data.`)) return;
    setBusyClientId(client.id);
    try {
      await deleteClient(client.id);
      await refresh();
    } finally {
      setBusyClientId("");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1 pb-2">
      <header className="surface-page p-5">
        <p className="text-kicker">Client management</p>
        <h1 className="mt-3 text-3xl font-semibold text-[color:var(--on-dark)]">Clients</h1>
      </header>
      <section className="surface-page p-4">
        <div className="grid gap-3 md:grid-cols-[1.5fr_0.8fr_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email, or client ID"
            className="field"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="field"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatus("all");
              setPage(1);
            }}
            className="button-secondary"
          >
            Reset
          </button>
        </div>
      </section>
      {loading ? <div className="surface-page p-4 text-sm text-[color:var(--on-dark-soft)]">Loading clients...</div> : null}
      {error ? <div className="surface-page border border-[color:var(--error)]/30 p-4 text-sm text-[color:var(--error)]">{error}</div> : null}
      <div className="surface-page overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-center text-sm">
            <thead className="bg-[color:var(--surface-dark-soft)] text-[color:var(--on-dark-soft)]">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">AI Key</th>
                <th className="px-4 py-3">Contexts</th>
                <th className="px-4 py-3">Chatbots</th>
                <th className="px-4 py-3">Usage</th>
                <th className="px-4 py-3">Queries Today</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-t border-[var(--hairline)]">
                  <td className="px-4 py-3 text-center">
                    <Link className="font-semibold text-[color:var(--on-dark)]" to={`/admin/clients/${client.id}`}>
                      {client.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-center text-[color:var(--on-dark-soft)]">{client.email}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="token-pill admin-status-badge border mx-auto text-[10px] uppercase tracking-[0.22em]"
                      data-status={String(client.status || "unknown").toLowerCase()}
                    >
                      {client.status || "unknown"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {client.hasGenerationConfig ? (
                      <span className="text-[color:var(--success)]">Configured</span>
                    ) : (
                      <span className="text-[color:var(--error)]">Not configured</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">{client.contextCount}</td>
                  <td className="px-4 py-3 text-center">{client.chatbotCount}</td>
                  <td className="px-4 py-3 text-center">{client.tokensUsedToday}</td>
                  <td className="px-4 py-3 text-center">{client.queriesUsedToday ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-center gap-2">
                      <button type="button" onClick={() => toggleStatus(client)} className="button-secondary px-3 py-2" disabled={busyClientId === client.id}>
                        {busyClientId === client.id ? "Working..." : client.status === "active" ? "Disable" : "Enable"}
                      </button>
                      <button type="button" onClick={() => remove(client)} className="button-danger px-3 py-2" disabled={busyClientId === client.id}>
                        {busyClientId === client.id ? "Working..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && clients.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-[color:var(--on-dark-soft)]" colSpan={9}>
                    No client accounts match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 surface-page p-4">
        <p className="text-sm text-[color:var(--on-dark-soft)]">
          Page {pageInfo.page} of {pageInfo.totalPages} · {pageInfo.totalItems} total
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="button-secondary px-3 py-2"
            disabled={loading || page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Prev
          </button>
          <button
            type="button"
            className="button-secondary px-3 py-2"
            disabled={loading || page >= pageInfo.totalPages}
            onClick={() => setPage((current) => Math.min(pageInfo.totalPages, current + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminClients;
