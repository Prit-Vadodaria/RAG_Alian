function CitationBadge({ label, onClick }) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="token-pill focus-ring"
      >
        {label}
      </button>
    );
  }

  return (
    <span className="token-pill">
      {label}
    </span>
  );
}

export default CitationBadge;
