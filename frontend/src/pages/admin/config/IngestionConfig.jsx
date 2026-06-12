import useAdminConfig from "../../../hooks/useAdminConfig";

function IngestionConfig() {
  const { sectionConfig, setSectionConfig, save, saving, loading, error, notice, isDirty } =
    useAdminConfig("ingestion");
  const config = sectionConfig || {};
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1 pb-2">
      <header className="surface-page p-5">
        <p className="text-kicker">Configuration</p>
        <h1 className="mt-3 text-3xl font-semibold text-[color:var(--on-dark)]">Ingestion</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--on-dark-soft)]">Adjust chunking and batching settings used during website ingestion.</p>
      </header>
      {error ? <div className="surface-page border border-[color:var(--error)]/30 p-4 text-sm text-[color:var(--error)]">{error}</div> : null}
      {notice ? <div className="surface-page border border-[color:var(--success)]/30 bg-[color:var(--success)]/10 p-4 text-sm text-[color:var(--success)]">{notice}</div> : null}
      <section className="surface-page space-y-5 p-5">
        {loading ? <p className="text-sm text-[color:var(--on-dark-soft)]">Loading...</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2"><span className="text-sm text-[color:var(--on-dark-soft)]">Max Chunk Tokens</span><input className="field w-full" type="number" min="1" value={config.max_chunk_tokens ?? 120} onChange={(event) => setSectionConfig({ ...config, max_chunk_tokens: Number(event.target.value || 0) })} disabled={loading || saving} /></label>
          <label className="block space-y-2"><span className="text-sm text-[color:var(--on-dark-soft)]">Min Chunk Tokens</span><input className="field w-full" type="number" min="1" value={config.min_chunk_tokens ?? 30} onChange={(event) => setSectionConfig({ ...config, min_chunk_tokens: Number(event.target.value || 0) })} disabled={loading || saving} /></label>
          <label className="block space-y-2"><span className="text-sm text-[color:var(--on-dark-soft)]">Chunk Overlap Tokens</span><input className="field w-full" type="number" min="0" value={config.chunk_overlap_tokens ?? 25} onChange={(event) => setSectionConfig({ ...config, chunk_overlap_tokens: Number(event.target.value || 0) })} disabled={loading || saving} /></label>
          <label className="block space-y-2"><span className="text-sm text-[color:var(--on-dark-soft)]">Batch Size</span><input className="field w-full" type="number" min="1" value={config.batch_size ?? 1} onChange={(event) => setSectionConfig({ ...config, batch_size: Number(event.target.value || 0) })} disabled={loading || saving} /></label>
        </div>
      </section>
      <div className="flex justify-end px-1 pb-2"><button type="button" onClick={save} disabled={saving || loading || !isDirty} className="button-primary">{saving ? "Saving..." : "Save"}</button></div>
    </div>
  );
}
export default IngestionConfig;
