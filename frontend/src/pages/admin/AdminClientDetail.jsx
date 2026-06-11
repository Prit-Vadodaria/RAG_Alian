import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { deleteClient, getClient, updateClient } from "../../services/admin";

function AdminClientDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getClient(id));
    } catch (err) {
      setError(err.message || String(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    (async () => {
      if (!active) return;
      setLoading(true);
      setError("");
      try {
        const clientData = await getClient(id);
        if (!active) return;
        setData(clientData);
      } catch (err) {
        if (!active) return;
        setError(err.message || String(err));
        setData(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [id]);

  const toggleStatus = async () => {
    setBusyAction("toggle");
    try {
      await updateClient(data.user.id, { status: data.user.status === "active" ? "disabled" : "active" });
      await refresh();
    } finally {
      setBusyAction("");
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${data.user.name}?`)) return;
    setBusyAction("delete");
    try {
      await deleteClient(data.user.id);
      window.history.back();
    } finally {
      setBusyAction("");
    }
  };

  if (loading) {
    return <div className="surface-page p-6 text-sm text-[color:var(--on-dark-soft)]">Loading client details...</div>;
  }

  if (error) {
    return <div className="surface-page border border-[color:var(--error)]/30 p-6 text-sm text-[color:var(--error)]">{error}</div>;
  }

  if (!data) {
    return <div className="surface-page p-6 text-sm text-[color:var(--on-dark-soft)]">No client data available.</div>;
  }

  const quota = data.quota || {};
  const usagePercent = Number.isFinite(Number(quota.usagePercent))
    ? Number(quota.usagePercent)
    : Number(quota.dailyLimit > 0 ? (quota.tokensUsed / quota.dailyLimit) * 100 : 0);
  const resetLabel = quota.cooldownDurationMinutes
    ? `${Number(quota.cooldownDurationMinutes).toLocaleString()} minute reset`
    : "Daily reset";

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1 pb-2">
      <header className="surface-page p-5">
        <p className="text-kicker">Client detail</p>
        <h1 className="mt-3 text-3xl font-semibold text-[color:var(--on-dark)]">{data.user.name}</h1>
        <p className="mt-2 text-sm text-[color:var(--on-dark-soft)]">{data.user.email}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-[color:var(--on-dark-soft)]">
          <span className="rounded-full border border-[var(--hairline)] bg-[color:var(--surface-2)] px-3 py-1">
            Status: <span className="font-semibold text-[color:var(--on-dark)]">{quota.status || "active"}</span>
          </span>
          <span className="rounded-full border border-[var(--hairline)] bg-[color:var(--surface-2)] px-3 py-1">
            Limit: <span className="font-semibold text-[color:var(--on-dark)]">{Number(quota.dailyLimit || 0).toLocaleString()}</span>
          </span>
          <span className="rounded-full border border-[var(--hairline)] bg-[color:var(--surface-2)] px-3 py-1">
            Reset: <span className="font-semibold text-[color:var(--on-dark)]">{resetLabel}</span>
          </span>
        </div>
      </header>
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <div className="surface-page p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Usage</h2>
              <p className="text-sm text-[color:var(--on-dark-soft)]">
                {usagePercent.toFixed(1)}% of limit used
              </p>
            </div>
            <p className="mt-2 text-sm text-[color:var(--on-dark-soft)]">
              Today: {Number(quota.tokensUsed || 0).toLocaleString()} tokens · Remaining: {Number(quota.tokensRemaining || 0).toLocaleString()}
            </p>
          </div>
          <div className="surface-page p-5">
            <h2 className="text-lg font-semibold">Contexts</h2>
            {data.contexts.length === 0 ? (
              <p className="mt-3 text-sm text-[color:var(--on-dark-soft)]">No contexts assigned.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-[color:var(--on-dark-soft)]">
                {data.contexts.map((context) => (
                  <li key={context.id} className="rounded-2xl border border-[var(--hairline)] bg-[color:var(--surface-1)] px-3 py-2">
                    <p className="font-medium text-[color:var(--on-dark)]">{context.name || context.id}</p>
                    <p className="text-xs text-[color:var(--on-dark-soft)]">{context.id}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="surface-page p-5">
            <h2 className="text-lg font-semibold">Chatbots</h2>
            {data.chatbots.length === 0 ? (
              <p className="mt-3 text-sm text-[color:var(--on-dark-soft)]">No chatbots assigned.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-[color:var(--on-dark-soft)]">
                {data.chatbots.map((chatbot) => (
                  <li key={chatbot.id} className="rounded-2xl border border-[var(--hairline)] bg-[color:var(--surface-1)] px-3 py-2">
                    <p className="font-medium text-[color:var(--on-dark)]">{chatbot.name}</p>
                    <p className="text-xs text-[color:var(--on-dark-soft)]">{chatbot.id}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="surface-page p-5">
            <p className="text-kicker">AI Configuration</p>
            <div className="mt-3 space-y-2 text-sm text-[color:var(--on-dark-soft)]">
              <p>
                API Key:{" "}
                {data.genConfig?.hasApiKey ? (
                  <span className="text-[color:var(--success)]">Configured</span>
                ) : (
                  <span className="text-[color:var(--error)]">Not configured</span>
                )}
              </p>
              <p>Model: {data.genConfig?.model || "—"}</p>
              <p>
                Daily Limit:{" "}
                {data.genConfig?.hasApiKey ? Number(data.genConfig?.dailyTokenLimit || 0).toLocaleString() : "—"}
              </p>
              <p>
                Configured:{" "}
                {data.genConfig?.configuredAt ? new Date(data.genConfig.configuredAt).toLocaleString() : "Never"}
              </p>
            </div>
          </div>
        </div>
        <aside className="surface-page space-y-3 p-5">
          <p className="text-kicker">Actions</p>
          <button type="button" onClick={toggleStatus} disabled={busyAction !== ""} className="button-secondary w-full justify-center">
            {busyAction === "toggle" ? "Updating..." : data.user.status === "active" ? "Disable" : "Enable"}
          </button>
          <button type="button" onClick={remove} disabled={busyAction !== ""} className="button-danger w-full justify-center">
            {busyAction === "delete" ? "Deleting..." : "Delete client"}
          </button>
        </aside>
        </div>
      </div>
  );
}

export default AdminClientDetail;
