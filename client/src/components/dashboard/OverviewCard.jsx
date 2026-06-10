function OverviewCard({
  title,
  value,
  icon: Icon,
  sublabel,
  colorClass = "text-[color:var(--primary)]",
}) {
  return (
    <div className="surface-page p-5">
      <div className="flex items-center gap-3">
        {Icon ? <Icon className={`h-5 w-5 ${colorClass}`} /> : null}
        <p className="text-kicker">{title}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold text-[color:var(--on-dark)]">
        {value}
      </p>
      {sublabel ? (
        <p className="mt-1 text-sm text-[color:var(--on-dark-soft)]">
          {sublabel}
        </p>
      ) : null}
    </div>
  );
}

export default OverviewCard;
