function NewChatButton({ onCreate, className = "" }) {
  const base =
    "flex items-center justify-center gap-2 rounded-2xl border border-cyan-500 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-300 transition hover:border-cyan-400 hover:bg-cyan-500/15";
  return (
    <button type="button" onClick={onCreate} className={`${base} ${className}`}>
      New Chat
    </button>
  );
}

export default NewChatButton;
