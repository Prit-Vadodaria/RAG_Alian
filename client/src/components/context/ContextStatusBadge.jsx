export default function ContextStatusBadge({ status }) {
  const normalized = (status || "ready").toLowerCase();
  const labelMap = {
    discovering: "Discovering",
    processing_batch: "Processing",
    partially_ready: "Partially ready",
    ready: "Ready",
    paused: "Paused",
    failed: "Failed",
    deleting: "Deleting",
  };

  return (
    <span className="status-pill" data-status={normalized}>
      {labelMap[normalized] || normalized}
    </span>
  );
}
