import { useEffect, useMemo, useState } from "react";
import { createApiClient } from "../../../services/http";

const SERVER_BASE =
  import.meta.env.VITE_CONTEXT_API_URL ||
  import.meta.env.VITE_SERVER_API_URL ||
  "http://127.0.0.1:5000/api";

const client = createApiClient(SERVER_BASE);

const deepEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function RegistrationConfig() {
  const [config, setConfig] = useState(null);
  const [baselineConfig, setBaselineConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    client
      .get("/admin/config")
      .then((response) => {
        if (!active) return;
        const next = response.data?.data || response.data || {};
        setConfig(next);
        setBaselineConfig(next);
      })
      .catch((err) => {
        if (active) setError(err.message || String(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const isDirty = useMemo(() => !deepEqual(config, baselineConfig), [config, baselineConfig]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!isDirty || saving || loading) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, loading, saving]);

  const updateNested = (current, section, key, value) => ({
    ...current,
    [section]: {
      ...(current?.[section] || {}),
      [key]: value,
    },
  });

  const save = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await client.put("/admin/config", config);
      const next = response.data?.data || response.data || config;
      setConfig(next);
      setBaselineConfig(next);
      setNotice("Saved and applied immediately.");
      window.dispatchEvent(new Event("rag-config-updated"));
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  const current = config || {};

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1 pb-2">
      <header className="surface-page p-5">
        <p className="text-kicker">Configuration</p>
        <h1 className="mt-3 text-3xl font-semibold text-[color:var(--on-dark)]">Registration</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--on-dark-soft)]">
          Control sign-up defaults, limits, and cooldowns for new accounts.
        </p>
      </header>

      {error ? <div className="surface-page border border-[color:var(--error)]/30 p-4 text-sm text-[color:var(--error)]">{error}</div> : null}
      {notice ? <div className="surface-page border border-[color:var(--success)]/30 bg-[color:var(--success)]/10 p-4 text-sm text-[color:var(--success)]">{notice}</div> : null}

      <section className="surface-page space-y-5 p-5">
        {loading ? <p className="text-sm text-[color:var(--on-dark-soft)]">Loading...</p> : null}
        <label className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--hairline)] bg-[color:var(--surface-2)] px-4 py-3">
          <span className="text-sm text-[color:var(--on-dark-soft)]">Registration enabled</span>
          <input
            type="checkbox"
            disabled={loading || saving}
            checked={Boolean(current.registration?.enabled)}
            onChange={(event) =>
              setConfig((state) => updateNested(state, "registration", "enabled", event.target.checked))
            }
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm text-[color:var(--on-dark-soft)]">Signup default model</span>
            <input
              className="field w-full"
              value={current.registration?.signup_default_model || ""}
              onChange={(event) =>
                setConfig((state) =>
                  updateNested(state, "registration", "signup_default_model", event.target.value),
                )
              }
              disabled={loading || saving}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-[color:var(--on-dark-soft)]">Signup default token limit</span>
            <input
              className="field w-full"
              type="number"
              min="1000"
              value={current.registration?.signup_default_token_limit ?? 50000}
              onChange={(event) =>
                setConfig((state) =>
                  updateNested(
                    state,
                    "registration",
                    "signup_default_token_limit",
                    Number(event.target.value || 0),
                  ),
                )
              }
              disabled={loading || saving}
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm text-[color:var(--on-dark-soft)]">Max website contexts per user</span>
            <input
              className="field w-full"
              type="number"
              min="0"
              value={current.registration?.max_contexts_per_client ?? 5}
              onChange={(event) =>
                setConfig((state) =>
                  updateNested(
                    state,
                    "registration",
                    "max_contexts_per_client",
                    Number(event.target.value || 0),
                  ),
                )
              }
              disabled={loading || saving}
            />
            <p className="text-xs text-[color:var(--on-dark-soft)]">Set to 0 to remove the limit.</p>
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-[color:var(--on-dark-soft)]">Max chatbots per user</span>
            <input
              className="field w-full"
              type="number"
              min="0"
              value={current.registration?.max_chatbots_per_client ?? 5}
              onChange={(event) =>
                setConfig((state) =>
                  updateNested(
                    state,
                    "registration",
                    "max_chatbots_per_client",
                    Number(event.target.value || 0),
                  ),
                )
              }
              disabled={loading || saving}
            />
            <p className="text-xs text-[color:var(--on-dark-soft)]">Set to 0 to remove the limit.</p>
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm text-[color:var(--on-dark-soft)]">Cooldown duration (minutes)</span>
          <input
            className="field w-full"
            type="number"
            min="0"
            value={current.quotas?.default_cooldown_minutes ?? 0}
            onChange={(event) =>
              setConfig((state) =>
                updateNested(
                  state,
                  "quotas",
                  "default_cooldown_minutes",
                  Number(event.target.value || 0),
                ),
              )
            }
            disabled={loading || saving}
          />
        </label>
      </section>

      <div className="flex justify-end px-1 pb-2">
        <button type="button" onClick={save} disabled={saving || loading || !isDirty} className="button-primary">
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

export default RegistrationConfig;
