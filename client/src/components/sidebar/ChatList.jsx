import { useMemo } from "react";

import ConversationItem from "./ConversationItem";
import { useChatStore } from "../../store/chatStore";
import { formatDateLabel } from "../../utils/format";

function ChatList() {
  const chats = useChatStore((state) => state.chats);
  const activeChatId = useChatStore((state) => state.activeChatId);
  const setActiveChat = useChatStore((state) => state.setActiveChat);
  const deleteChat = useChatStore((state) => state.deleteChat);

  const groupedChats = useMemo(() => {
    const today = new Date().toLocaleDateString();
    return chats.reduce((groups, chat) => {
      const dateKey =
        new Date(chat.createdAt).toLocaleDateString() === today
          ? "Today"
          : formatDateLabel(chat.createdAt);
      groups[dateKey] = groups[dateKey] || [];
      groups[dateKey].push(chat);
      return groups;
    }, {});
  }, [chats]);

  return (
    <div className="space-y-4">
      {Object.keys(groupedChats).map((group) => (
        <div key={group} className="space-y-3">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
            {group}
          </p>
          <div className="space-y-3">
            {groupedChats[group].map((chat) => (
              <ConversationItem
                key={chat.id}
                chat={chat}
                active={chat.id === activeChatId}
                onSelect={setActiveChat}
                onDelete={deleteChat}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ChatList;
