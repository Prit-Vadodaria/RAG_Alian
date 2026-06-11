import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteClient, listClients, updateClient } from "../../services/admin";

function AdminClients() {
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyClientId, setBusyClientId] = useState("");

  const refresh = async () => {
    try {
      setLoading(true);
      setClients(await listClients());
      setError("");
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

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
      {loading ? <div className="surface-page p-4 text-sm text-[color:var(--on-dark-soft)]">Loading clients...</div> : null}
      {error ? <div className="surface-page border border-[rgba(184,78,78,0.22)] p-4 text-sm text-[#f1c0c0]">{error}</div> : null}
      <div className="surface-page overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[color:var(--surface-dark-soft)] text-[color:var(--on-dark-soft)]">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">AI Key</th>
                <th className="px-4 py-3">Contexts</th>
                <th className="px-4 py-3">Chatbots</th>
                <th className="px-4 py-3">Usage</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-t border-[rgba(255,255,255,0.08)]">
                  <td className="px-4 py-3">
                    <Link className="font-semibold text-[color:var(--on-dark)]" to={`/admin/clients/${client.id}`}>
                      {client.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[color:var(--on-dark-soft)]">{client.email}</td>
                  <td className="px-4 py-3">
                    <span className={`token-pill text-[10px] uppercase tracking-[0.22em] ${client.status === "active" ? "bg-[rgba(79,157,103,0.14)] text-[#c8e6d1]" : "bg-[rgba(184,78,78,0.14)] text-[#f1c0c0]"}`}>
                      {client.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {client.hasGenerationConfig ? (
                      <span className="text-[color:var(--success)]">Configured</span>
                    ) : (
                      <span className="text-[color:var(--error)]">Not configured</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{client.contextCount}</td>
                  <td className="px-4 py-3">{client.chatbotCount}</td>
                  <td className="px-4 py-3">{client.tokensUsedToday}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => toggleStatus(client)} className="button-secondary px-3 py-2" disabled={busyClientId === client.id}>
                        {busyClientId === client.id ? "Working..." : client.status === "active" ? "Disable" : "Enable"}
                      </button>
                      <button type="button" onClick={() => remove(client)} className="button-secondary px-3 py-2" disabled={busyClientId === client.id}>
                        {busyClientId === client.id ? "Working..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && clients.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-[color:var(--on-dark-soft)]" colSpan={8}>
                    No client accounts yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminClients;
