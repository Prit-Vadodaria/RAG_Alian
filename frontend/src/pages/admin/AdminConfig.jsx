import { useEffect, useMemo, useState } from "react";
import { createApiClient } from "../../services/http";

const SERVER_BASE =
  import.meta.env.VITE_CONTEXT_API_URL ||
  import.meta.env.VITE_SERVER_API_URL ||
  "http://127.0.0.1:5000/api";

const client = createApiClient(SERVER_BASE);

const updateNested = (current, section, key, value) => ({
  ...current,
  [section]: {
    ...(current?.[section] || {}),
    [key]: value,
  },
});

function AdminConfig() {
  const [config, setConfig] = useState(null);
  const [baselineConfig, setBaselineConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isDirty = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(baselineConfig),
    [config, baselineConfig],
  );

  const loadConfig = async () => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await client.get("/admin/config");
      const nextConfig = response.data?.data || response.data;
      setConfig(nextConfig);
      setBaselineConfig(nextConfig);
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

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!isDirty || saving || loading) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, loading, saving]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await client.put("/admin/config", config);
      const nextConfig = response.data?.data || response.data;
      setConfig(nextConfig);
      setBaselineConfig(nextConfig);
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
          Manage registration, cooldown, and the shared retrieval/ingestion settings used by the platform.
        </p>
      </header>

      {error ? <div className="surface-page border border-[color:var(--error)]/30 p-4 text-sm text-[color:var(--error)]">{error}</div> : null}
      {notice ? <div className="surface-page border border-[color:var(--success)]/30 bg-[color:var(--success)]/10 p-4 text-sm text-[color:var(--success)]">{notice}</div> : null}
      <div className="space-y-4">
        <section className="surface-page space-y-5 p-5">
          {loading ? <p className="text-sm text-[color:var(--on-dark-soft)]">Loading platform settings...</p> : null}

          <label className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--hairline)] bg-[color:var(--surface-2)] px-4 py-3">
            <span className="text-sm text-[color:var(--on-dark-soft)]">Registration enabled</span>
            <input
              type="checkbox"
              disabled={loading || saving}
              checked={Boolean(config?.registration?.enabled)}
              onChange={(event) =>
                setConfig((current) =>
                  updateNested(current, "registration", "enabled", event.target.checked),
                )
              }
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--on-dark-soft)]">Signup default model</span>
              <input
                className="field w-full"
                value={config?.registration?.signup_default_model || ""}
                onChange={(event) =>
                  setConfig((current) =>
                    updateNested(current, "registration", "signup_default_model", event.target.value),
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
                value={config?.registration?.signup_default_token_limit ?? 50000}
                onChange={(event) =>
                  setConfig((current) =>
                    updateNested(
                      current,
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
                value={config?.registration?.max_contexts_per_client ?? 5}
                onChange={(event) =>
                  setConfig((current) =>
                    updateNested(
                      current,
                      "registration",
                      "max_contexts_per_client",
                      Number(event.target.value || 0),
                    ),
                  )
                }
                disabled={loading || saving}
              />
              <p className="text-xs text-[color:var(--on-dark-soft)]">
                Set to 0 to remove the limit.
              </p>
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--on-dark-soft)]">Max chatbots per user</span>
              <input
                className="field w-full"
                type="number"
                min="0"
                value={config?.registration?.max_chatbots_per_client ?? 5}
                onChange={(event) =>
                  setConfig((current) =>
                    updateNested(
                      current,
                      "registration",
                      "max_chatbots_per_client",
                      Number(event.target.value || 0),
                    ),
                  )
                }
                disabled={loading || saving}
              />
              <p className="text-xs text-[color:var(--on-dark-soft)]">
                Set to 0 to remove the limit.
              </p>
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm text-[color:var(--on-dark-soft)]">Cooldown duration (minutes)</span>
            <input
              className="field w-full"
              type="number"
              disabled={loading || saving}
              value={config?.quotas?.default_cooldown_minutes ?? 0}
              onChange={(event) =>
                setConfig((current) =>
                  updateNested(
                    current,
                    "quotas",
                    "default_cooldown_minutes",
                    Number(event.target.value || 0),
                  ),
                )
              }
            />
          </label>
        </section>

        <section className="surface-page space-y-4 p-5">
          <p className="text-kicker">Embedding Configuration</p>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--on-dark-soft)]">Embedding Model</span>
              <input
                className="field w-full"
                value={config?.embedding?.model || ""}
                onChange={(event) =>
                  setConfig((current) =>
                    updateNested(current, "embedding", "model", event.target.value),
                  )
                }
                disabled={loading || saving}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--on-dark-soft)]">Batch Size</span>
              <input
                className="field w-full"
                type="number"
                min="1"
                value={config?.embedding?.batch_size ?? 32}
                onChange={(event) =>
                  setConfig((current) =>
                    updateNested(current, "embedding", "batch_size", Number(event.target.value || 0)),
                  )
                }
                disabled={loading || saving}
              />
            </label>
          </div>
        </section>

        <section className="surface-page space-y-5 p-5">
          <div className="space-y-1">
            <p className="text-kicker">Reranking Configuration</p>
            <p className="text-sm leading-6 text-[color:var(--on-dark-soft)]">
              Fine-tune the second-pass ranking layer used to improve result quality.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--hairline)] bg-[color:var(--surface-1)] p-4">
            <label className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="block text-sm font-medium text-[color:var(--on-dark)]">Enable reranking</span>
                <span className="block text-xs leading-5 text-[color:var(--on-dark-soft)]">
                  Turn this on to re-order candidate chunks before the final answer is generated.
                </span>
              </div>
              <input
                type="checkbox"
                checked={Boolean(config?.reranking?.enabled)}
                onChange={(event) =>
                  setConfig((current) =>
                    updateNested(current, "reranking", "enabled", event.target.checked),
                  )
                }
                disabled={loading || saving}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--on-dark-soft)]">Backend</span>
              <input
                className="field w-full"
                value={config?.reranking?.backend || ""}
                onChange={(event) =>
                  setConfig((current) =>
                    updateNested(current, "reranking", "backend", event.target.value),
                  )
                }
                disabled={loading || saving}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--on-dark-soft)]">Model</span>
              <input
                className="field w-full"
                value={config?.reranking?.model || ""}
                onChange={(event) =>
                  setConfig((current) =>
                    updateNested(current, "reranking", "model", event.target.value),
                  )
                }
                disabled={loading || saving}
              />
            </label>
          </div>
        </section>

        <section className="surface-page space-y-4 p-5">
          <p className="text-kicker">Retrieval Configuration</p>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--on-dark-soft)]">Vector Top K</span>
              <input
                className="field w-full"
                type="number"
                min="1"
                value={config?.retrieval?.vector_top_k ?? 10}
                onChange={(event) =>
                  setConfig((current) =>
                    updateNested(current, "retrieval", "vector_top_k", Number(event.target.value || 0)),
                  )
                }
                disabled={loading || saving}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--on-dark-soft)]">Final Top K</span>
              <input
                className="field w-full"
                type="number"
                min="1"
                value={config?.retrieval?.final_top_k ?? 5}
                onChange={(event) =>
                  setConfig((current) =>
                    updateNested(current, "retrieval", "final_top_k", Number(event.target.value || 0)),
                  )
                }
                disabled={loading || saving}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--on-dark-soft)]">Max Search Distance</span>
              <input
                className="field w-full"
                type="number"
                step="0.05"
                value={config?.retrieval?.max_search_distance ?? 1.15}
                onChange={(event) =>
                  setConfig((current) =>
                    updateNested(
                      current,
                      "retrieval",
                      "max_search_distance",
                      Number(event.target.value || 0),
                    ),
                  )
                }
                disabled={loading || saving}
              />
            </label>
          </div>
        </section>

        <section className="surface-page space-y-4 p-5">
          <p className="text-kicker">Ingestion Configuration</p>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--on-dark-soft)]">Max Chunk Tokens</span>
              <input
                className="field w-full"
                type="number"
                min="1"
                value={config?.ingestion?.max_chunk_tokens ?? 120}
                onChange={(event) =>
                  setConfig((current) =>
                    updateNested(
                      current,
                      "ingestion",
                      "max_chunk_tokens",
                      Number(event.target.value || 0),
                    ),
                  )
                }
                disabled={loading || saving}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--on-dark-soft)]">Min Chunk Tokens</span>
              <input
                className="field w-full"
                type="number"
                min="1"
                value={config?.ingestion?.min_chunk_tokens ?? 30}
                onChange={(event) =>
                  setConfig((current) =>
                    updateNested(
                      current,
                      "ingestion",
                      "min_chunk_tokens",
                      Number(event.target.value || 0),
                    ),
                  )
                }
                disabled={loading || saving}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--on-dark-soft)]">Chunk Overlap Tokens</span>
              <input
                className="field w-full"
                type="number"
                min="0"
                value={config?.ingestion?.chunk_overlap_tokens ?? 25}
                onChange={(event) =>
                  setConfig((current) =>
                    updateNested(
                      current,
                      "ingestion",
                      "chunk_overlap_tokens",
                      Number(event.target.value || 0),
                    ),
                  )
                }
                disabled={loading || saving}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--on-dark-soft)]">Batch Size</span>
              <input
                className="field w-full"
                type="number"
                min="1"
                value={config?.ingestion?.batch_size ?? 1}
                onChange={(event) =>
                  setConfig((current) =>
                    updateNested(current, "ingestion", "batch_size", Number(event.target.value || 0)),
                  )
                }
                disabled={loading || saving}
              />
            </label>
          </div>
        </section>

        <div className="flex justify-end px-1 pb-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="button-primary"
          >
            {saving ? "Saving..." : "Save configuration"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminConfig;
