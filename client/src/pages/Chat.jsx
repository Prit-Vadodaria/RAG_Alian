import { useEffect, useMemo, useState } from "react";

import { useChatStore } from "../store/chatStore";
import { askRag } from "../services/rag";
import ChatHeader from "../components/chat/ChatHeader";
import ChatWindow from "../components/chat/ChatWindow";
import MessageBubble from "../components/chat/MessageBubble";
import ThinkingBubble from "../components/chat/ThinkingBubble";
import ChatInput from "../components/chat/ChatInput";
import EmptyState from "../components/chat/EmptyState";
import SourceDrawer from "../components/source/SourceDrawer";
import ConfidenceBar from "../components/metrics/ConfidenceBar";
import RetrievalStats from "../components/metrics/RetrievalStats";
import LatencyBadge from "../components/metrics/LatencyBadge";
import { createChatTitle /*, formatDuration*/ } from "../utils/format";

const thinkingMessages = [
  "Searching knowledge base...",
  "Retrieving relevant documents...",
  "Analyzing retrieved context...",
  "Evaluating document relevance...",
  "Generating grounded response...",
];

const createMessage = ({
  role,
  content,
  citations = [],
  sources = [],
  confidence = {},
  latency = {},
}) => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  content,
  citations,
  sources,
  confidence,
  latency,
  createdAt: new Date().toISOString(),
});

function Chat() {
  const chats = useChatStore((state) => state.chats);
  const activeChatId = useChatStore((state) => state.activeChatId);
  const setActiveChat = useChatStore((state) => state.setActiveChat);
  const addMessage = useChatStore((state) => state.addMessage);
  const updateChatTitle = useChatStore((state) => state.updateChatTitle);

  const [isThinking, setIsThinking] = useState(false);
  const [thinkingMessage, setThinkingMessage] = useState(thinkingMessages[0]);
  const [selectedSource, setSelectedSource] = useState(null);

  const activeChat = chats.find((chat) => chat.id === activeChatId) || chats[0];

  useEffect(() => {
    if (!activeChat && chats.length) {
      setActiveChat(chats[0].id);
    }
  }, [activeChat, chats, setActiveChat]);

  const lastAssistantMessage = useMemo(
    () =>
      [...(activeChat?.messages || [])]
        .reverse()
        .find((message) => message.role === "assistant"),
    [activeChat],
  );

  const handleSend = async (prompt) => {
    if (!activeChat) return;

    const userMessage = createMessage({ role: "user", content: prompt });
    addMessage(activeChat.id, userMessage);

    if (activeChat.title === "New conversation") {
      updateChatTitle(activeChat.id, createChatTitle(prompt));
    }

    setIsThinking(true);
    let nextIndex = 0;
    setThinkingMessage(thinkingMessages[0]);
    const intervalId = window.setInterval(() => {
      nextIndex = (nextIndex + 1) % thinkingMessages.length;
      setThinkingMessage(thinkingMessages[nextIndex]);
    }, 1000);

    try {
      const response = await askRag(prompt);
      const assistantMessage = createMessage({
        role: "assistant",
        content:
          response.answer || "No answer was returned by the RAG service.",
        citations:
          response.citations ||
          (response.sources?.map((source) => source.source_id) ?? []),
        sources:
          response.sources?.map((source) => ({
            ...source,
            text: source.text ?? source.chunk_text ?? "",
            similarity: source.similarity ?? source.similarity_score ?? null,
          })) ?? [],
        confidence: {
          overall: response.confidence ?? response.confidence?.overall ?? 0,
          retrieval:
            response.confidence?.retrieval ??
            response.confidence_breakdown?.retrieval ??
            0,
          grounding:
            response.confidence?.grounding ??
            response.confidence_breakdown?.grounding ??
            0,
          rerank:
            response.confidence?.rerank ??
            response.confidence_breakdown?.rerank ??
            0,
        },
        latency: {
          total: response.latency_ms ?? response.latency ?? 0,
          retrieval:
            response.metrics?.retrieval_latency_ms ??
            response.latency?.retrieval ??
            0,
          generation:
            response.metrics?.generation_latency_ms ??
            response.latency?.generation ??
            0,
        },
      });
      addMessage(activeChat.id, assistantMessage);
    } catch (error) {
      const assistantMessage = createMessage({
        role: "assistant",
        content: `Failed to retrieve answer: ${error.message}`,
      });
      addMessage(activeChat.id, assistantMessage);
    } finally {
      setIsThinking(false);
      window.clearInterval(intervalId);
    }
  };

  if (!activeChat) {
    return <EmptyState />;
  }

  return (
    <div className="flex h-full flex-col gap-8">
      <ChatHeader
        title={activeChat.title}
        messageCount={activeChat.messages.length}
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ChatWindow>
          <div className="flex  flex-1 flex-col gap-5 overflow-y-auto">
            {activeChat.messages.length === 0 ? (
              <EmptyState />
            ) : (
              activeChat.messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onSelectSource={setSelectedSource}
                />
              ))
            )}
            {isThinking && <ThinkingBubble message={thinkingMessage} />}
          </div>
          <ChatInput onSubmit={handleSend} disabled={isThinking} />
        </ChatWindow>
        <aside className="space-y-6 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm shadow-cyan-500/5">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-[0.28em] text-zinc-400">
                Latest metrics
              </h2>
              <span className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                Live
              </span>
            </div>
            <LatencyBadge value={lastAssistantMessage?.latency?.total ?? 0} />
            <RetrievalStats latency={lastAssistantMessage?.latency ?? {}} />
          </div>
          <div className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-zinc-400">
              Confidence
            </h3>
            <ConfidenceBar
              label="Retrieval"
              value={lastAssistantMessage?.confidence?.retrieval ?? 0}
              colorClass="bg-cyan-500"
            />
            <ConfidenceBar
              label="Grounding"
              value={lastAssistantMessage?.confidence?.grounding ?? 0}
              colorClass="bg-sky-500"
            />
            <ConfidenceBar
              label="Rerank"
              value={lastAssistantMessage?.confidence?.rerank ?? 0}
              colorClass="bg-cyan-400"
            />
          </div>
        </aside>
      </div>
      <SourceDrawer
        source={selectedSource}
        onClose={() => setSelectedSource(null)}
      />
    </div>
  );
}

export default Chat;
