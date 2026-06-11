import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import ConversationItem from "./ConversationItem";
import { useChatStore } from "../../store/chatStore";
import { formatDateLabel } from "../../utils/format";

function ChatList({ collapsed, onAfterSelect }) {
  if (collapsed) return null;
  const navigate = useNavigate();
  const chats = useChatStore((state) => state.chats);
  const activeChatId = useChatStore((state) => state.activeChatId);
  const setActiveChat = useChatStore((state) => state.setActiveChat);
  const deleteChat = useChatStore((state) => state.deleteChat);

  const handleSelectChat = (chatId) => {
    setActiveChat(chatId);
    navigate("/");
    onAfterSelect?.();
  };

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
          <p className="text-kicker text-[color:var(--on-dark-soft)]">
            {group}
          </p>
          <div className="space-y-3">
            {groupedChats[group].map((chat) => (
              <ConversationItem
                key={chat.id}
                chat={chat}
                active={chat.id === activeChatId}
                onSelect={handleSelectChat}
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
