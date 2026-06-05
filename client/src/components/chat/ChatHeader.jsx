import { MessageSquare } from "lucide-react";

function ChatHeader({ title, messageCount }) {
  return (
    <div className="surface-page flex-shrink-0 px-5 py-4">
      <div>
        <p className="text-kicker">
          Workspace conversation
        </p>
        <h1 className="text-surface-title mt-2 text-2xl font-semibold">{title}</h1>
      </div>
      <div className="token-pill gap-2">
        <MessageSquare className="h-4 w-4 text-[color:var(--primary)]" />
        {messageCount} messages
      </div>
    </div>
  );
}

export default ChatHeader;
