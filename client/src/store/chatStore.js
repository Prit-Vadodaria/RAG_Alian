import { create } from "zustand";
import { useAuthStore } from "./authStore";

const STORAGE_KEY_PREFIX = "rag-workspace-chats";

const createId = () =>
  `chat-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;

const createChat = () => ({
  id: createId(),
  title: "New conversation",
  createdAt: new Date().toISOString(),
  messages: [],
});

const getStorageKey = (userId = "") =>
  `${STORAGE_KEY_PREFIX}-${String(userId || "guest").trim() || "guest"}`;

const loadState = (userId = "") => {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) {
      const firstChat = createChat();
      return { chats: [firstChat], activeChatId: firstChat.id };
    }
    const state = JSON.parse(raw);
    if (!Array.isArray(state.chats) || !state.activeChatId) {
      const firstChat = createChat();
      return { chats: [firstChat], activeChatId: firstChat.id };
    }
    return state;
  } catch (error) {
    const firstChat = createChat();
    return { chats: [firstChat], activeChatId: firstChat.id };
  }
};

const saveState = (state, userId = "") => {
  localStorage.setItem(getStorageKey(userId), JSON.stringify(state));
};

const initialUserId = useAuthStore.getState().user?.id || "guest";
const initialState = loadState(initialUserId);

export const useChatStore = create((set, get) => ({
  chats: initialState.chats,
  activeChatId: initialState.activeChatId,
  storageUserId: initialUserId,
  loadForUser: (userId) => {
    const nextUserId = String(userId || "guest").trim() || "guest";
    const nextState = loadState(nextUserId);
    set({
      chats: nextState.chats,
      activeChatId: nextState.activeChatId,
      storageUserId: nextUserId,
    });
  },
  setActiveChat: (chatId) => {
    set((state) => {
      const next = { ...state, activeChatId: chatId };
      saveState(next, state.storageUserId);
      return next;
    });
  },
  createChat: () => {
    const newChat = createChat();
    set((state) => {
      const next = {
        ...state,
        chats: [newChat, ...state.chats],
        activeChatId: newChat.id,
      };
      saveState(next, state.storageUserId);
      return next;
    });
  },
  deleteChat: (chatId) => {
    set((state) => {
      const chats = state.chats.filter((chat) => chat.id !== chatId);
      const activeChatId =
        state.activeChatId === chatId
          ? (chats[0]?.id ?? "")
          : state.activeChatId;
      const next = { ...state, chats, activeChatId };
      saveState(next, state.storageUserId);
      return next;
    });
  },
  addMessage: (chatId, message) => {
    set((state) => {
      const chats = state.chats.map((chat) =>
        chat.id === chatId
          ? { ...chat, messages: [...chat.messages, message] }
          : chat,
      );
      const next = { ...state, chats };
      saveState(next, state.storageUserId);
      return next;
    });
  },
  updateChatTitle: (chatId, title) => {
    set((state) => {
      const chats = state.chats.map((chat) =>
        chat.id === chatId ? { ...chat, title } : chat,
      );
      const next = { ...state, chats };
      saveState(next, state.storageUserId);
      return next;
    });
  },
  resetChats: () => {
    const fresh = createChat();
    const next = { chats: [fresh], activeChatId: fresh.id };
    set(next);
    saveState(next, get().storageUserId);
  },
}));
