export default function ContextStatusBadge({ status }) {
  const normalized = (status || "ready").toLowerCase();

  return (
    <span className="status-pill" data-status={normalized}>
      {normalized}
    </span>
  );
}
