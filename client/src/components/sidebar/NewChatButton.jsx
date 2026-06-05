function NewChatButton({ onCreate, className = "" }) {
  const base = "button-primary";
  return (
    <button type="button" onClick={onCreate} className={`${base} ${className}`}>
      New Chat
    </button>
  );
}

export default NewChatButton;
