import useAdminConfig from "../../../hooks/useAdminConfig";

function RetrievalConfig() {
  const { sectionConfig, setSectionConfig, save, saving, loading, error, notice, isDirty } =
    useAdminConfig("retrieval");
  const config = sectionConfig || {};
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1 pb-2">
      <header className="surface-page p-5">
        <p className="text-kicker">Configuration</p>
        <h1 className="mt-3 text-3xl font-semibold text-[color:var(--on-dark)]">Retrieval</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--on-dark-soft)]">Control how many chunks are fetched and how far results may drift.</p>
      </header>
      {error ? <div className="surface-page border border-[color:var(--error)]/30 p-4 text-sm text-[color:var(--error)]">{error}</div> : null}
      {notice ? <div className="surface-page border border-[color:var(--success)]/30 bg-[color:var(--success)]/10 p-4 text-sm text-[color:var(--success)]">{notice}</div> : null}
      <section className="surface-page space-y-5 p-5">
        {loading ? <p className="text-sm text-[color:var(--on-dark-soft)]">Loading...</p> : null}
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block space-y-2"><span className="text-sm text-[color:var(--on-dark-soft)]">Vector Top K</span><input className="field w-full" type="number" min="1" value={config.vector_top_k ?? 10} onChange={(event) => setSectionConfig({ ...config, vector_top_k: Number(event.target.value || 0) })} disabled={loading || saving} /></label>
          <label className="block space-y-2"><span className="text-sm text-[color:var(--on-dark-soft)]">Final Top K</span><input className="field w-full" type="number" min="1" value={config.final_top_k ?? 5} onChange={(event) => setSectionConfig({ ...config, final_top_k: Number(event.target.value || 0) })} disabled={loading || saving} /></label>
          <label className="block space-y-2"><span className="text-sm text-[color:var(--on-dark-soft)]">Max Search Distance</span><input className="field w-full" type="number" step="0.05" value={config.max_search_distance ?? 1.15} onChange={(event) => setSectionConfig({ ...config, max_search_distance: Number(event.target.value || 0) })} disabled={loading || saving} /></label>
        </div>
      </section>
      <div className="flex justify-end px-1 pb-2"><button type="button" onClick={save} disabled={saving || loading || !isDirty} className="button-primary">{saving ? "Saving..." : "Save"}</button></div>
    </div>
  );
}
export default RetrievalConfig;
