function SectionCard({ title, children }) {
  return (
    <section className="surface-page p-5">
      <h3 className="mb-4 text-kicker">
        {title}
      </h3>
      <div>{children}</div>
    </section>
  );
}

export default SectionCard;
