import { useEffect, useState } from "react";
import { createApiClient } from "../../services/http";

const SERVER_BASE =
  import.meta.env.VITE_CONTEXT_API_URL ||
  import.meta.env.VITE_SERVER_API_URL ||
  "http://127.0.0.1:5000/api";

const client = createApiClient(SERVER_BASE);

function AdminConfig() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadConfig = async () => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await client.get("/admin/config");
      setConfig(response.data?.data || response.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig().catch((err) => {
      setError(err.message || String(err));
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await client.put("/admin/config", config);
      setConfig(response.data?.data || response.data);
      setNotice("Saved and applied immediately.");
      window.dispatchEvent(new Event("rag-config-updated"));
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1 pb-2">
      <header className="surface-page p-5">
        <p className="text-kicker">Configuration</p>
        <h1 className="mt-3 text-3xl font-semibold text-[color:var(--on-dark)]">Platform config</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--on-dark-soft)]">
          These values control the platform defaults. Client overrides stay intact, and the dashboard refreshes as soon as you save.
        </p>
      </header>
      {error ? <div className="surface-page border border-[rgba(184,78,78,0.22)] p-4 text-sm text-[#f1c0c0]">{error}</div> : null}
      {notice ? <div className="surface-page border border-[rgba(79,157,103,0.22)] bg-[rgba(79,157,103,0.08)] p-4 text-sm text-[#c8e6d1]">{notice}</div> : null}
      <div className="surface-page space-y-5 p-5">
        {loading ? <p className="text-sm text-[color:var(--on-dark-soft)]">Loading platform settings...</p> : null}
        <label className="block space-y-2">
          <span className="text-sm text-[color:var(--on-dark-soft)]">Registration enabled</span>
          <input
            type="checkbox"
            disabled={loading || saving}
            checked={Boolean(config?.registration?.enabled)}
            onChange={(event) =>
              setConfig((current) => ({
                ...current,
                registration: {
                  ...(current?.registration || {}),
                  enabled: event.target.checked,
                },
              }))
            }
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm text-[color:var(--on-dark-soft)]">Default daily token limit</span>
          <input
            className="field w-full"
            type="number"
            disabled={loading || saving}
            value={config?.quotas?.default_daily_token_limit ?? 0}
            onChange={(event) =>
              setConfig((current) => ({
                ...current,
                quotas: {
                  ...(current?.quotas || {}),
                  default_daily_token_limit: Number(event.target.value || 0),
                },
              }))
            }
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm text-[color:var(--on-dark-soft)]">Default cooldown minutes</span>
          <input
            className="field w-full"
            type="number"
            disabled={loading || saving}
            value={config?.quotas?.default_cooldown_minutes ?? 0}
            onChange={(event) =>
              setConfig((current) => ({
                ...current,
                quotas: {
                  ...(current?.quotas || {}),
                  default_cooldown_minutes: Number(event.target.value || 0),
                },
              }))
            }
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={handleSave} disabled={saving} className="button-primary">
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => loadConfig().catch((err) => setError(err.message || String(err)))}
            disabled={loading || saving}
            className="button-secondary"
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminConfig;
