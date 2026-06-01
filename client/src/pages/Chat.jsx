import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

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
import { createChatTitle } from "../utils/format";
import { useContextStore } from "../store/contextStore";
import { usePromptSettingsStore } from "../store/promptSettingsStore";

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
  const navigate = useNavigate();
  const chats = useChatStore((state) => state.chats);
  const activeChatId = useChatStore((state) => state.activeChatId);
  const setActiveChat = useChatStore((state) => state.setActiveChat);
  const createChat = useChatStore((state) => state.createChat);
  const addMessage = useChatStore((state) => state.addMessage);
  const updateChatTitle = useChatStore((state) => state.updateChatTitle);

  const [isThinking, setIsThinking] = useState(false);
  const [thinkingMessage, setThinkingMessage] = useState(thinkingMessages[0]);
  const [selectedSource, setSelectedSource] = useState(null);
  const chatScrollRef = useRef(null);

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

  useEffect(() => {
    const scrollElement = chatScrollRef.current;
    if (!scrollElement) return;
    scrollElement.scrollTop = scrollElement.scrollHeight;
  }, [activeChat?.messages?.length, isThinking]);

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
      const selectedContext =
        useContextStore.getState().selectedContext || "alian_default";
      const promptSettings = usePromptSettingsStore.getState().settings;
      const response = await askRag(prompt, selectedContext, promptSettings);
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
          overall:
            response.confidence?.overall ??
            response.confidence_breakdown?.overall ??
            0,
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
          rerank:
            response.metrics?.rerank_latency_ms ??
            response.latency?.rerank ??
            0,
          generation:
            response.metrics?.generation_latency_ms ??
            response.latency?.generation ??
            0,
          inputTokens:
            response.metrics?.input_tokens ?? response.tokens?.input ?? 0,
          outputTokens:
            response.metrics?.output_tokens ?? response.tokens?.output ?? 0,
          totalTokens:
            response.metrics?.total_tokens ?? response.tokens?.total ?? 0,
          throughput:
            response.metrics?.throughput_tokens_per_second ??
            response.tokens?.throughput ??
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

  const handleNewChat = () => {
    createChat();
    navigate("/");
  };

  if (!activeChat) {
    return <EmptyState onNewChat={handleNewChat} onSelectPrompt={handleSend} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <ChatHeader
        title={activeChat.title}
        messageCount={activeChat.messages.length}
      />
      <div className="grid h-full min-h-0 flex-1 gap-4 overflow-hidden xl:grid-cols-[minmax(0,1fr)_320px]">
        <ChatWindow>
          <div className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden px-2 py-3 sm:px-0 sm:py-0">
            <div
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto space-y-3 p-3"
            >
              {activeChat.messages.length === 0 ? (
                <EmptyState
                  onNewChat={handleNewChat}
                  onSelectPrompt={handleSend}
                />
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
          </div>
          <div className="border-t border-zinc-800 bg-[#0b0c11] p-3 sm:p-4">
            <ChatInput onSubmit={handleSend} disabled={isThinking} />
          </div>
        </ChatWindow>
        <aside className="space-y-4 overflow-hidden pr-1">
          <div className="rounded-[1.75rem] border border-zinc-800 bg-[#111317] p-4 shadow-[0_32px_80px_rgba(15,23,42,0.18)]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-400">
                Latest metrics
              </h2>
              <span className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                Live
              </span>
            </div>
            <div className="mt-3 space-y-3">
              <LatencyBadge value={lastAssistantMessage?.latency?.total ?? 0} />
              <RetrievalStats latency={lastAssistantMessage?.latency ?? {}} />
            </div>
          </div>
          <div className="rounded-[1.75rem] border border-zinc-800 bg-[#111317] p-4 shadow-[0_32px_80px_rgba(15,23,42,0.18)]">
            <h3 className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-400">
              Confidence overview
            </h3>
            <div className="mt-3 space-y-3">
              <ConfidenceBar
                label="Overall"
                value={lastAssistantMessage?.confidence?.overall ?? 0}
                colorClass="bg-cyan-400"
              />
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


