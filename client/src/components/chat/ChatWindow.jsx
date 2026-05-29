function ChatWindow({ children }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[2rem] border border-zinc-800 bg-[#0f1116] shadow-[0_40px_90px_rgba(15,23,42,0.22)]">
      {children}
    </div>
  );
}

export default ChatWindow;
