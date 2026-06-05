function ChatWindow({ children }) {
  return (
    <div className="chat-shell flex h-full flex-col overflow-hidden">
      {children}
    </div>
  );
}

export default ChatWindow;
