import { useEffect, useState } from "react";

import SectionCard from "../components/ui/SectionCard";
import { useAiConfigStore } from "../store/aiConfigStore";
import { useContextStore } from "../store/contextStore";
import { useDashboardStore } from "../store/dashboardStore";

const GEMINI_MODELS = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "gemini-2.0-flash-exp", label: "Gemini 2.0 Flash (Exp)" },
];

function AiConfig() {
  const config = useAiConfigStore((state) => state.config);
  const loading = useAiConfigStore((state) => state.loading);
  const fetchConfig = useAiConfigStore((state) => state.fetchConfig);
  const saveConfig = useAiConfigStore((state) => state.saveConfig);
  const showToast = useContextStore((state) => state.showToast);
  const summary = useDashboardStore((state) => state.summary);
  const fetchSummary = useDashboardStore((state) => state.fetchSummary);

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState("gemini-2.5-flash");
  const [dailyTokenLimit, setDailyTokenLimit] = useState(50000);
  const [timeoutSeconds, setTimeoutSeconds] = useState(60);
  const [temperature, setTemperature] = useState(0.2);
  const [maxOutputTokens, setMaxOutputTokens] = useState(512);
  const [maxRetries, setMaxRetries] = useState(5);
  const [retryBackoff, setRetryBackoff] = useState(2);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    fetchConfig()
      .then((cfg) => {
        if (!cfg) return;
        setModel(cfg.model || "gemini-2.5-flash");
        setDailyTokenLimit(cfg.dailyTokenLimit || 50000);
        setTimeoutSeconds(cfg.timeoutSeconds || 60);
        setTemperature(cfg.temperature ?? 0.2);
        setMaxOutputTokens(cfg.maxOutputTokens || 512);
        setMaxRetries(cfg.maxRetries || 5);
        setRetryBackoff(cfg.retryBackoff || 2);
      })
      .catch((error) => {
        setLoadError(error.message || String(error));
      });
    fetchSummary().catch(() => {});
  }, [fetchConfig, fetchSummary]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const updates = {
        model,
        dailyTokenLimit: Number(dailyTokenLimit),
        timeoutSeconds: Number(timeoutSeconds),
        temperature: Number(temperature),
        maxOutputTokens: Number(maxOutputTokens),
        maxRetries: Number(maxRetries),
        retryBackoff: Number(retryBackoff),
      };
      if (apiKey.trim()) {
        updates.googleApiKey = apiKey.trim();
      }
      await saveConfig(updates);
      setApiKey("");
      showToast("AI configuration saved.", "success");
      window.dispatchEvent(new Event("rag-config-updated"));
      await fetchSummary();
    } catch (error) {
      showToast(error.message || String(error), "error");
    } finally {
      setSaving(false);
    }
  };

  const hasKey = Boolean(config?.hasApiKey);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1 pb-2">
      <header className="surface-page p-5">
        <p className="text-kicker">Generation settings</p>
        <h1 className="mt-3 text-3xl font-semibold text-[color:var(--on-dark)]">AI Configuration</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--on-dark-soft)]">
          Configure your own Google Gemini key, model, and usage limits. The key is never shown back after saving.
        </p>
      </header>

      {loadError ? (
        <div className="surface-page border border-[color:var(--error)]/30 p-4 text-sm text-[color:var(--error)]">
          {loadError}
        </div>
      ) : null}

      {!hasKey ? (
        <div className="surface-page border border-[color:var(--error)]/30 bg-[color:var(--error)]/10 p-4 text-sm text-[color:var(--error)]">
          No API key configured yet. Queries will fail until you add a valid Google Gemini API key.
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <SectionCard title="API Credentials">
          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--on-dark-soft)]">Google Gemini API Key</span>
              <div className="flex gap-2">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={hasKey ? "Enter a new key to replace the current one" : "Paste your API key"}
                  className="field flex-1"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowKey((value) => !value)} className="button-secondary px-3">
                  {showKey ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--on-dark-soft)]">Gemini Model</span>
              <select value={model} onChange={(event) => setModel(event.target.value)} className="field w-full">
                {GEMINI_MODELS.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </SectionCard>

        <SectionCard title="Usage Limits">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--on-dark-soft)]">Daily Token Limit</span>
              <input
                type="number"
                min="1000"
                value={dailyTokenLimit}
                onChange={(event) => setDailyTokenLimit(event.target.value)}
                className="field w-full"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--on-dark-soft)]">Timeout Seconds</span>
              <input
                type="number"
                min="10"
                max="300"
                value={timeoutSeconds}
                onChange={(event) => setTimeoutSeconds(event.target.value)}
                className="field w-full"
              />
            </label>
          </div>
        </SectionCard>

        <SectionCard title="Generation Tuning">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--on-dark-soft)]">Temperature</span>
              <input
                type="number"
                min="0"
                max="2"
                step="0.05"
                value={temperature}
                onChange={(event) => setTemperature(event.target.value)}
                className="field w-full"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--on-dark-soft)]">Max Output Tokens</span>
              <input
                type="number"
                min="64"
                value={maxOutputTokens}
                onChange={(event) => setMaxOutputTokens(event.target.value)}
                className="field w-full"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--on-dark-soft)]">Max Retries</span>
              <input
                type="number"
                min="1"
                value={maxRetries}
                onChange={(event) => setMaxRetries(event.target.value)}
                className="field w-full"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--on-dark-soft)]">Retry Backoff</span>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={retryBackoff}
                onChange={(event) => setRetryBackoff(event.target.value)}
                className="field w-full"
              />
            </label>
          </div>
        </SectionCard>

        <SectionCard title="Usage Statistics">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="surface-card p-4">
              <p className="text-kicker">Today tokens</p>
              <p className="mt-2 text-lg font-semibold text-[color:var(--on-dark)]">
                {Number(summary?.todayTokensUsed || 0).toLocaleString()}
              </p>
            </div>
            <div className="surface-card p-4">
              <p className="text-kicker">Remaining</p>
              <p className="mt-2 text-lg font-semibold text-[color:var(--on-dark)]">
                {Number(summary?.tokensRemaining || 0).toLocaleString()}
              </p>
            </div>
            <div className="surface-card p-4">
              <p className="text-kicker">Status</p>
              <p className="mt-2 text-lg font-semibold text-[color:var(--on-dark)]">
                {summary?.accountStatus || "active"}
              </p>
            </div>
          </div>
        </SectionCard>

        <div className="flex justify-end">
          <button type="submit" disabled={saving || loading} className="button-primary">
            {saving ? "Saving..." : "Save configuration"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default AiConfig;
