import { useEffect, useMemo, useState } from "react";
import { createApiClient } from "../../../services/http";
import { validatePromptSettings } from "../../../utils/validatePromptSettings";

const SERVER_BASE =
  import.meta.env.VITE_CONTEXT_API_URL ||
  import.meta.env.VITE_SERVER_API_URL ||
  "http://127.0.0.1:5000/api";

const client = createApiClient(SERVER_BASE);

const normalizeConstraints = (text) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

function PromptSeedConfig() {
  const [promptSeed, setPromptSeed] = useState(null);
  const [baselinePromptSeed, setBaselinePromptSeed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    client
      .get("/admin/prompt-settings")
      .then((response) => {
        if (!active) return;
        const next = response.data?.data || response.data || {};
        setPromptSeed(next);
        setBaselinePromptSeed(next);
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

  const isDirty = useMemo(() => JSON.stringify(promptSeed) !== JSON.stringify(baselinePromptSeed), [promptSeed, baselinePromptSeed]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!isDirty || saving || loading) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, loading, saving]);

  const save = async () => {
    const current = promptSeed || {};
    const role = String(current.role || "").trim();
    const constraints = normalizeConstraints((current.constraints || []).join("\n"));
    const validationError = validatePromptSettings({ role, constraints });
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await client.put("/admin/prompt-settings", {
        ...(baselinePromptSeed || {}),
        ...current,
        role,
        constraints,
      });
      const next = response.data?.data || response.data || current;
      setPromptSeed(next);
      setBaselinePromptSeed(next);
      setNotice("Prompt settings seed saved.");
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
        <h1 className="mt-3 text-3xl font-semibold text-[color:var(--on-dark)]">Prompt Seed</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--on-dark-soft)]">Edit the default prompt copied to new clients at signup.</p>
      </header>
      {error ? <div className="surface-page border border-[color:var(--error)]/30 p-4 text-sm text-[color:var(--error)]">{error}</div> : null}
      {notice ? <div className="surface-page border border-[color:var(--success)]/30 bg-[color:var(--success)]/10 p-4 text-sm text-[color:var(--success)]">{notice}</div> : null}
      <section className="surface-page space-y-5 p-5">
        {loading ? <p className="text-sm text-[color:var(--on-dark-soft)]">Loading...</p> : null}
        <label className="block space-y-2">
          <span className="text-sm text-[color:var(--on-dark-soft)]">Role</span>
          <textarea className="field w-full" rows={4} value={promptSeed?.role || ""} onChange={(event) => setPromptSeed((current) => ({ ...(current || {}), role: event.target.value }))} disabled={loading || saving} />
        </label>
        <label className="block space-y-2">
          <span className="text-sm text-[color:var(--on-dark-soft)]">Constraints (one per line)</span>
          <textarea className="field w-full" rows={8} value={(promptSeed?.constraints || []).join("\n")} onChange={(event) => setPromptSeed((current) => ({ ...(current || {}), constraints: event.target.value.split("\n") }))} disabled={loading || saving} />
        </label>
      </section>
      <div className="flex justify-end px-1 pb-2"><button type="button" onClick={save} disabled={saving || loading || !isDirty} className="button-primary">{saving ? "Saving..." : "Save"}</button></div>
    </div>
  );
}
export default PromptSeedConfig;
