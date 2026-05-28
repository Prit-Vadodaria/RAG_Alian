function SectionCard({ title, children }) {
  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm shadow-cyan-500/5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.32em] text-zinc-500">
        {title}
      </h3>
      <div>{children}</div>
    </section>
  );
}

export default SectionCard;
