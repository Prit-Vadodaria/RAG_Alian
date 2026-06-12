import useAdminConfig from "../../../hooks/useAdminConfig";

function RerankingConfig() {
  const { sectionConfig, setSectionConfig, save, saving, loading, error, notice, isDirty } =
    useAdminConfig("reranking");
  const config = sectionConfig || {};
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1 pb-2">
      <header className="surface-page p-5">
        <p className="text-kicker">Configuration</p>
        <h1 className="mt-3 text-3xl font-semibold text-[color:var(--on-dark)]">Reranking</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--on-dark-soft)]">Tune the second-pass reranking layer.</p>
      </header>
      {error ? <div className="surface-page border border-[color:var(--error)]/30 p-4 text-sm text-[color:var(--error)]">{error}</div> : null}
      {notice ? <div className="surface-page border border-[color:var(--success)]/30 bg-[color:var(--success)]/10 p-4 text-sm text-[color:var(--success)]">{notice}</div> : null}
      <section className="surface-page space-y-5 p-5">
        {loading ? <p className="text-sm text-[color:var(--on-dark-soft)]">Loading...</p> : null}
        <label className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--hairline)] bg-[color:var(--surface-2)] px-4 py-3">
          <div className="space-y-1">
            <span className="block text-sm font-medium text-[color:var(--on-dark)]">Enable reranking</span>
            <span className="block text-xs leading-5 text-[color:var(--on-dark-soft)]">Turn this on to re-order candidate chunks before the final answer.</span>
          </div>
          <input type="checkbox" checked={Boolean(config.enabled)} onChange={(event) => setSectionConfig({ ...config, enabled: event.target.checked })} disabled={loading || saving} />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2"><span className="text-sm text-[color:var(--on-dark-soft)]">Backend</span><input className="field w-full" value={config.backend || ""} onChange={(event) => setSectionConfig({ ...config, backend: event.target.value })} disabled={loading || saving} /></label>
          <label className="block space-y-2"><span className="text-sm text-[color:var(--on-dark-soft)]">Model</span><input className="field w-full" value={config.model || ""} onChange={(event) => setSectionConfig({ ...config, model: event.target.value })} disabled={loading || saving} /></label>
        </div>
      </section>
      <div className="flex justify-end px-1 pb-2"><button type="button" onClick={save} disabled={saving || loading || !isDirty} className="button-primary">{saving ? "Saving..." : "Save"}</button></div>
    </div>
  );
}
export default RerankingConfig;
