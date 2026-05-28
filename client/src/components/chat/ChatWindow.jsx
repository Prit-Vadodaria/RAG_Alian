function ChatWindow({ children }) {
  return (
    <div className="flex min-h-[50vh] flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 p-4 shadow-sm shadow-cyan-500/5">
      {children}
    </div>
  );
}

export default ChatWindow;
