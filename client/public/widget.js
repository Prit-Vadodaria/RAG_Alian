(function () {
  const script = document.currentScript;
  if (!script) return;

  const chatbotId =
    script.dataset.chatbotId || script.getAttribute("data-chatbot-id");
  if (!chatbotId) {
    console.error("[widget] Missing data-chatbot-id");
    return;
  }

  function normalizeApiBase(value) {
    const normalized = String(value || "")
      .trim()
      .replace(/\/$/, "");
    if (!normalized) {
      return window.location.origin;
    }
    const withoutApi = normalized.replace(/\/api$/, "");
    return withoutApi || window.location.origin;
  }

  function createId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function truncate(value, maxLength) {
    const text = String(value || "")
      .trim()
      .replace(/\s+/g, " ");
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
  }

  function formatTimestamp(value) {
    if (!value) return "";
    try {
      return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value));
    } catch {
      return "";
    }
  }

  const apiBase = normalizeApiBase(
    script.dataset.apiBase || script.getAttribute("data-api-base") || "",
  );

  const rootHost = document.createElement("div");
  rootHost.id = `rag-widget-${chatbotId}`;
  rootHost.style.all = "initial";
  (document.body || document.documentElement).appendChild(rootHost);

  const shadowRoot = rootHost.attachShadow({ mode: "open" });
  const visitorIdKey = `rag-widget-visitor-${chatbotId}`;
  const stateKey = `rag-widget-state-${chatbotId}`;
  const legacySessionKey = `rag-widget-session-${chatbotId}`;

  function getVisitorId() {
    try {
      const existing = localStorage.getItem(visitorIdKey);
      if (existing) return existing;
      const created = `visitor_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
      localStorage.setItem(visitorIdKey, created);
      return created;
    } catch {
      return `visitor_${Math.random().toString(36).slice(2, 10)}`;
    }
  }

  function createChatSession({
    title = "New chat",
    messages = [],
    draft = "",
  } = {}) {
    const now = new Date().toISOString();
    return {
      id: createId("chat"),
      title,
      createdAt: now,
      updatedAt: now,
      messages: Array.isArray(messages) ? messages : [],
      draft: String(draft || ""),
    };
  }

  function deriveTitleFromFirstUserMessage(messages) {
    const firstUser = (messages || []).find(
      (message) => message.role === "user",
    );
    return truncate(firstUser?.content || "New chat", 34) || "New chat";
  }

  function normalizeChatSession(raw) {
    const now = new Date().toISOString();
    const messages = Array.isArray(raw?.messages)
      ? raw.messages
          .filter((message) => message && typeof message === "object")
          .map((message) => ({
            id: String(message.id || createId("msg")),
            role: message.role === "assistant" ? "assistant" : "user",
            content: String(message.content || ""),
          }))
      : [];
    const title =
      truncate(raw?.title || deriveTitleFromFirstUserMessage(messages), 34) ||
      "New chat";
    return {
      id: String(raw?.id || createId("chat")),
      title,
      createdAt: String(raw?.createdAt || raw?.created_at || now),
      updatedAt: String(raw?.updatedAt || raw?.updated_at || now),
      messages,
      draft: String(raw?.draft || ""),
    };
  }

  function loadWidgetState() {
    try {
      const raw = localStorage.getItem(stateKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed === "object" &&
          Array.isArray(parsed.chats)
        ) {
          return {
            activeChatId: String(parsed.activeChatId || ""),
            chats: parsed.chats.map(normalizeChatSession),
          };
        }
      }
    } catch {
      // fall through to legacy migration
    }

    try {
      const legacy = localStorage.getItem(legacySessionKey);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed)) {
          const chat = createChatSession({
            title: deriveTitleFromFirstUserMessage(parsed),
            messages: parsed
              .filter((message) => message && typeof message === "object")
              .map((message) => ({
                id: String(message.id || createId("msg")),
                role: message.role === "assistant" ? "assistant" : "user",
                content: String(message.content || ""),
              })),
          });
          return {
            activeChatId: chat.id,
            chats: [chat],
          };
        }
      }
    } catch {
      // ignore migration failures and fall back to a clean state
    }

    const chat = createChatSession();
    return {
      activeChatId: chat.id,
      chats: [chat],
    };
  }

  function saveWidgetState() {
    try {
      localStorage.setItem(
        stateKey,
        JSON.stringify({
          activeChatId: state.activeChatId,
          chats: state.chats,
        }),
      );
    } catch {
      // ignore storage errors
    }
  }

  const state = {
    config: null,
    chats: [],
    activeChatId: "",
    input: "",
    loading: true,
    sending: false,
    open: false,
    historyOpen: false,
    error: "",
    deleteConfirmId: "",
    pendingChatId: "",
    activeRequestId: "",
    scrollToBottom: false,
  };

  const hydrated = loadWidgetState();
  state.chats = hydrated.chats.length ? hydrated.chats : [createChatSession()];
  state.activeChatId = hydrated.activeChatId || state.chats[0].id;
  const hydratedActive =
    state.chats.find((chat) => chat.id === state.activeChatId) ||
    state.chats[0];
  state.activeChatId = hydratedActive.id;
  state.input = hydratedActive.draft || "";
  saveWidgetState();

  function getActiveChat() {
    if (!state.chats.length) {
      const chat = createChatSession();
      state.chats = [chat];
      state.activeChatId = chat.id;
      state.input = "";
      saveWidgetState();
      return chat;
    }
    const active = state.chats.find((chat) => chat.id === state.activeChatId);
    if (active) return active;
    state.chats.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    state.activeChatId = state.chats[0].id;
    state.input = state.chats[0].draft || "";
    saveWidgetState();
    return state.chats[0];
  }

  function touchChat(chat) {
    chat.updatedAt = new Date().toISOString();
  }

  function persistChatDraft(chatId, draft) {
    const chat = state.chats.find((item) => item.id === chatId);
    if (!chat) return;
    chat.draft = draft;
    touchChat(chat);
    saveWidgetState();
  }

  function replaceChat(updatedChat) {
    state.chats = state.chats.map((chat) =>
      chat.id === updatedChat.id ? updatedChat : chat,
    );
  }

  function appendMessage(chatId, role, content) {
    const chat = state.chats.find((item) => item.id === chatId);
    if (!chat) return null;
    const next = {
      ...chat,
      messages: [
        ...chat.messages,
        {
          id: createId("msg"),
          role,
          content,
        },
      ],
    };
    touchChat(next);
    if (role === "user" && (chat.title === "New chat" || !chat.title)) {
      next.title = deriveTitleFromFirstUserMessage(next.messages);
    }
    replaceChat(next);
    saveWidgetState();
    return next;
  }

  function createNewChat() {
    const current = getActiveChat();
    persistChatDraft(current.id, state.input);
    const chat = createChatSession();
    state.chats = [chat, ...state.chats];
    state.activeChatId = chat.id;
    state.input = "";
    state.sending = false;
    state.pendingChatId = "";
    state.activeRequestId = "";
    state.deleteConfirmId = "";
    state.historyOpen = false;
    state.scrollToBottom = true;
    saveWidgetState();
    render();
  }

  function switchChat(chatId) {
    const nextChat = state.chats.find((chat) => chat.id === chatId);
    if (!nextChat || nextChat.id === state.activeChatId) return;
    const current = getActiveChat();
    persistChatDraft(current.id, state.input);
    state.activeChatId = nextChat.id;
    state.input = nextChat.draft || "";
    state.deleteConfirmId = "";
    state.scrollToBottom = true;
    saveWidgetState();
    render();
  }

  function deleteChat(chatId, confirmed = false) {
    if (!confirmed) {
      state.deleteConfirmId = chatId;
      render();
      return;
    }

    const target = state.chats.find((chat) => chat.id === chatId);
    if (!target) return;

    state.chats = state.chats.filter((chat) => chat.id !== chatId);

    if (state.pendingChatId === chatId) {
      state.sending = false;
      state.pendingChatId = "";
      state.activeRequestId = "";
    }

    if (state.activeChatId === chatId) {
      const nextChat = [...state.chats].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )[0];
      if (nextChat) {
        state.activeChatId = nextChat.id;
        state.input = nextChat.draft || "";
      } else {
        const fresh = createChatSession();
        state.chats = [fresh];
        state.activeChatId = fresh.id;
        state.input = "";
      }
    }

    state.deleteConfirmId = "";
    state.scrollToBottom = true;
    saveWidgetState();
    render();
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      throw new Error(
        data.error || `Request failed with status ${response.status}`,
      );
    }
    return data.data ?? data;
  }

  async function loadConfig() {
    state.loading = true;
    render();
    try {
      state.config = await fetchJson(
        `${apiBase}/public/chatbot/${encodeURIComponent(chatbotId)}`,
      );
      state.error = "";
    } catch (error) {
      state.error = error.message || "Unable to load chatbot configuration.";
    } finally {
      state.loading = false;
      render();
    }
  }

  async function sendMessage() {
    const message = state.input.trim();
    if (!message || state.sending || state.loading) return;

    const chat = getActiveChat();
    const chatId = chat.id;
    const requestId = createId("req");

    state.input = "";
    persistChatDraft(chatId, "");
    appendMessage(chatId, "user", message);

    state.sending = true;
    state.pendingChatId = chatId;
    state.activeRequestId = requestId;
    state.scrollToBottom = true;
    saveWidgetState();
    render();

    try {
      const payload = {
        chatbot_id: chatbotId,
        visitor_id: getVisitorId(),
        message,
        origin: window.location.origin,
      };
      const response = await fetchJson(`${apiBase}/public/chat`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (state.activeRequestId !== requestId) {
        return;
      }

      if (state.chats.some((item) => item.id === chatId)) {
        appendMessage(
          chatId,
          "assistant",
          response.answer || "I don't know based on the provided context.",
        );
        state.scrollToBottom = true;
      }
    } catch (error) {
      if (state.activeRequestId !== requestId) {
        return;
      }
      if (state.chats.some((item) => item.id === chatId)) {
        appendMessage(
          chatId,
          "assistant",
          `Unable to answer right now: ${error.message}`,
        );
        state.scrollToBottom = true;
      }
    } finally {
      if (state.activeRequestId === requestId) {
        state.sending = false;
        state.pendingChatId = "";
        state.activeRequestId = "";
        saveWidgetState();
        render();
      }
    }
  }

  function resizeTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = "0px";
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, 40), 112);
    textarea.style.height = `${nextHeight}px`;
  }

  function openWidget() {
    state.open = true;
    state.historyOpen = false;
    render();
  }

  function closeWidget() {
    state.open = false;
    state.historyOpen = false;
    state.deleteConfirmId = "";
    render();
  }

  function toggleHistory() {
    state.historyOpen = !state.historyOpen;
    state.deleteConfirmId = "";
    render();
  }

  function styleText() {
    const theme = state.config?.theme || {};
    const accent = theme.accent || "#22d3ee";
    const bg = theme.background || "#0b1020";
    const panel = theme.panel || "#111827";
    const text = theme.text || "#e5e7eb";
    const muted = theme.muted || "#9ca3af";
    const surface = theme.surface || "rgba(255,255,255,.05)";
    const border = theme.border || "rgba(255,255,255,.10)";
    const userGradient =
      theme.user_gradient || `linear-gradient(135deg, ${accent}, #60a5fa)`;

    return `
      :host {
        all: initial;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      * {
        box-sizing: border-box;
      }
      .launcher {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 2147483647;
        width: 64px;
        height: 64px;
        border: none;
        border-radius: 999px;
        background: transparent;
        color: #06111a;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
        cursor: pointer;
        display: ${state.open ? "none" : "grid"};
        place-items: center;
        padding: 0;
        transition: transform 180ms ease, box-shadow 180ms ease, filter 180ms ease;
      }
      .launcher svg {
        width: 64px;
        height: 64px;
        display: block;
        filter: drop-shadow(0 14px 26px rgba(37, 99, 235, 0.18));
      }
      .launcher:hover {
        transform: translateY(-2px) scale(1.02);
        box-shadow: 0 26px 70px rgba(0, 0, 0, 0.34);
        filter: brightness(1.04);
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      .panel {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 2147483647;
        width: min(424px, calc(100vw - 40px));
        height: min(680px, calc(100vh - 40px));
        border-radius: 28px;
        overflow: hidden;
        display: ${state.open ? "flex" : "none"};
        flex-direction: column;
        background:
          radial-gradient(circle at top, rgba(255, 255, 255, 0.07), transparent 32%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 28%),
          ${panel};
        color: ${text};
        border: 1px solid ${border};
        box-shadow: 0 30px 90px rgba(0, 0, 0, 0.42);
      }
      .panel-shell {
        position: relative;
        flex: 1;
        display: flex;
        min-height: 0;
        overflow: hidden;
      }
      .header {
        padding: 14px 16px 12px;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        background: rgba(255, 255, 255, 0.025);
        border-bottom: 1px solid ${border};
        backdrop-filter: blur(10px);
      }
      .title {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }
      .title strong {
        font-size: 14px;
        line-height: 1.2;
        letter-spacing: -0.01em;
      }
      .title span,
      .meta,
      .status {
        font-size: 12px;
        color: ${muted};
      }
      .header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .chip,
      .icon-button,
      .close,
      .new-chat,
      .history-toggle,
      .history-item,
      .history-action,
      .confirm-button,
      .send {
        border: none;
        outline: none;
        transition: transform 180ms ease, background 180ms ease, border-color 180ms ease, opacity 180ms ease, color 180ms ease, box-shadow 180ms ease;
      }
      .chip,
      .icon-button,
      .close,
      .new-chat,
      .history-toggle {
        border-radius: 999px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font: inherit;
        font-size: 12px;
        line-height: 1;
        white-space: nowrap;
      }
      .chip:focus-visible,
      .icon-button:focus-visible,
      .close:focus-visible,
      .new-chat:focus-visible,
      .history-toggle:focus-visible,
      .history-item:focus-visible,
      .history-action:focus-visible,
      .history-delete:focus-visible,
      .confirm-button:focus-visible,
      .send:focus-visible,
      .input:focus-visible {
        outline: 2px solid rgba(34, 211, 238, 0.72);
        outline-offset: 2px;
      }
      .history-toggle,
      .new-chat {
        min-height: 34px;
        padding: 0 12px;
        background: rgba(255, 255, 255, 0.06);
        color: ${text};
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      .new-chat {
        background: linear-gradient(135deg, rgba(34, 211, 238, 0.18), rgba(96, 165, 250, 0.16));
        border-color: rgba(34, 211, 238, 0.24);
      }
      .history-toggle:hover,
      .new-chat:hover,
      .close:hover,
      .icon-button:hover,
      .chip:hover,
      .confirm-button:hover,
      .send:hover {
        transform: translateY(-1px);
      }
      .close {
        min-width: 34px;
        height: 34px;
        background: rgba(255, 255, 255, 0.06);
        color: ${text};
      }
      .workspace {
        position: relative;
        flex: 1;
        display: flex;
        min-height: 0;
        overflow: hidden;
      }
      .history {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: var(--history-width);
        transform: translateX(calc(-1 * var(--history-width)));
        opacity: 0;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 14px;
        background: rgba(7, 10, 20, 0.96);
        border-right: 1px solid ${border};
        box-shadow: 16px 0 42px rgba(0, 0, 0, 0.26);
        transition: transform 220ms ease, opacity 220ms ease;
        z-index: 4;
      }
      .panel.history-open .history {
        transform: translateX(0);
        opacity: 1;
        pointer-events: auto;
      }
      .history-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .history-header strong {
        font-size: 13px;
        letter-spacing: -0.01em;
      }
      .history-meta {
        font-size: 12px;
        color: ${muted};
      }
      .history-list {
        flex: 1;
        min-height: 0;
        overflow: auto;
        padding-right: 4px;
      }
      .history-item {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 6px;
        text-align: left;
        padding: 12px 12px 11px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.06);
        color: ${text};
        margin-bottom: 10px;
        cursor: pointer;
      }
      .history-item:hover {
        background: rgba(255, 255, 255, 0.07);
        border-color: rgba(255, 255, 255, 0.12);
      }
      .history-item.active {
        background: linear-gradient(135deg, rgba(34, 211, 238, 0.13), rgba(96, 165, 250, 0.09));
        border-color: rgba(34, 211, 238, 0.28);
        box-shadow: inset 0 0 0 1px rgba(34, 211, 238, 0.12);
      }
      .history-item.delete-confirm {
        border-color: rgba(248, 113, 113, 0.32);
        background: rgba(127, 29, 29, 0.22);
      }
      .history-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
      }
      .history-title {
        font-size: 13px;
        font-weight: 600;
        line-height: 1.2;
        flex: 1;
        min-width: 0;
      }
      .history-preview {
        font-size: 12px;
        line-height: 1.45;
        color: ${muted};
      }
      .history-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .history-time {
        font-size: 11px;
        color: ${muted};
      }
      .history-delete {
        opacity: 0;
        pointer-events: none;
        min-height: 28px;
        padding: 0 10px;
        border-radius: 999px;
        background: rgba(248, 113, 113, 0.12);
        color: #fecaca;
        border: 1px solid rgba(248, 113, 113, 0.18);
        font-size: 12px;
      }
      .history-item:hover .history-delete,
      .history-item.delete-confirm .history-delete {
        opacity: 1;
        pointer-events: auto;
      }
      .history-confirm {
        display: flex;
        gap: 8px;
        padding-top: 4px;
      }
      .confirm-button {
        min-height: 30px;
        padding: 0 10px;
        border-radius: 999px;
        font-size: 12px;
        cursor: pointer;
      }
      .confirm-button.cancel {
        background: rgba(255, 255, 255, 0.07);
        color: ${text};
      }
      .confirm-button.delete {
        background: rgba(248, 113, 113, 0.16);
        color: #fecaca;
        border: 1px solid rgba(248, 113, 113, 0.22);
      }
      .backdrop {
        position: absolute;
        inset: 0;
        background: rgba(2, 6, 23, 0.38);
        opacity: 0;
        pointer-events: none;
        transition: opacity 220ms ease;
        z-index: 3;
      }
      .panel.history-open .backdrop {
        opacity: 1;
        pointer-events: auto;
      }
      .conversation {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        min-height: 0;
        transition: margin-left 220ms ease, transform 220ms ease;
      }
      .panel.history-open .conversation {
        margin-left: var(--history-width);
      }
      .conversation-header {
        padding: 12px 16px 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        border-bottom: 1px solid ${border};
        background: rgba(255, 255, 255, 0.015);
      }
      .conversation-header .summary {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .conversation-header .summary strong {
        font-size: 13px;
      }
      .conversation-header .summary span {
        font-size: 11px;
        color: ${muted};
      }
      .messages {
        flex: 1;
        min-height: 0;
        overflow: auto;
        padding: 14px 14px 10px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        scroll-behavior: smooth;
        scrollbar-gutter: stable;
      }
      .messages.empty {
        justify-content: center;
      }
      .empty-state {
        padding: 20px 18px;
        border-radius: 20px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.04);
        color: ${text};
      }
      .empty-state strong {
        display: block;
        margin-bottom: 6px;
        font-size: 14px;
      }
      .empty-state p {
        margin: 0;
        font-size: 13px;
        line-height: 1.55;
        color: ${muted};
      }
      .bubble {
        max-width: 84%;
        padding: 11px 13px;
        border-radius: 18px;
        line-height: 1.45;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 13px;
        letter-spacing: -0.005em;
      }
      .user {
        align-self: flex-end;
        background: ${userGradient};
        color: #04111a;
        border-bottom-right-radius: 7px;
        box-shadow: 0 10px 28px rgba(34, 211, 238, 0.14);
      }
      .assistant {
        align-self: flex-start;
        background: rgba(255, 255, 255, 0.065);
        color: ${text};
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-bottom-left-radius: 7px;
      }
      .typing {
        align-self: flex-start;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 38px;
        padding: 10px 13px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: ${muted};
        font-size: 12px;
      }
      .typing::before {
        content: "";
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: ${accent};
        box-shadow: 12px 0 0 ${accent}, 24px 0 0 ${accent};
        opacity: 0.9;
      }
      .composer-wrap {
        padding: 10px 12px 12px;
        border-top: 1px solid ${border};
        background: rgba(0, 0, 0, 0.16);
      }
      .composer {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        padding: 0;
      }
      .input {
        flex: 1;
        min-height: 40px;
        max-height: 112px;
        resize: none;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.045);
        color: ${text};
        padding: 10px 12px;
        outline: none;
        font: inherit;
        line-height: 1.45;
        scrollbar-gutter: stable;
        transition: border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
      }
      .input::placeholder {
        color: rgba(156, 163, 175, 0.86);
      }
      .input:focus {
        border-color: rgba(34, 211, 238, 0.54);
        box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.12);
        background: rgba(255, 255, 255, 0.06);
      }
      .send {
        min-width: 62px;
        height: 40px;
        padding: 0 14px;
        border-radius: 14px;
        background: linear-gradient(135deg, ${accent}, #60a5fa);
        color: #04111a;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 10px 24px rgba(34, 211, 238, 0.14);
      }
      .send:disabled,
      .input:disabled,
      .history-toggle:disabled,
      .new-chat:disabled,
      .close:disabled,
      .history-delete:disabled,
      .confirm-button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
        transform: none;
      }
      .status,
      .error {
        padding: 0 14px 8px;
      }
      .error {
        font-size: 12px;
        color: #fca5a5;
      }
      .scrollable {
        scrollbar-width: thin;
        scrollbar-color: rgba(148, 163, 184, 0.44) rgba(15, 23, 42, 0.18);
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
      }
      .scrollable::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      .scrollable::-webkit-scrollbar-track {
        background: rgba(15, 23, 42, 0.18);
        border-radius: 999px;
      }
      .scrollable::-webkit-scrollbar-thumb {
        background: rgba(148, 163, 184, 0.46);
        border-radius: 999px;
        border: 2px solid rgba(15, 23, 42, 0.18);
      }
      .scrollable::-webkit-scrollbar-thumb:hover {
        background: rgba(148, 163, 184, 0.62);
      }
      @media (max-width: 640px) {
        .panel {
          right: 12px;
          bottom: 12px;
          width: calc(100vw - 24px);
          height: calc(100vh - 24px);
          border-radius: 22px;
        }
        .header {
          padding: 12px 12px 10px;
        }
        .conversation-header {
          padding: 10px 12px 8px;
        }
        .panel.history-open .conversation {
          margin-left: 0;
        }
        .history {
          width: min(88vw, 320px);
        }
        .bubble {
          max-width: 88%;
        }
        .composer-wrap {
          padding: 10px;
        }
        .messages {
          padding: 12px;
        }
      }
    `;
  }

  function renderHistoryItem(chat) {
    const active = chat.id === state.activeChatId;
    const isConfirming = state.deleteConfirmId === chat.id;
    const lastMessage = chat.messages[chat.messages.length - 1];
    const preview = lastMessage
      ? truncate(lastMessage.content, 62)
      : "No messages yet";
    const time = formatTimestamp(chat.updatedAt);
    return `
      <div class="history-item ${active ? "active" : ""} ${isConfirming ? "delete-confirm" : ""}" data-chat-id="${escapeHtml(chat.id)}" role="button" tabindex="0" aria-label="Open ${escapeHtml(chat.title)}">
        <div class="history-row">
          <div class="history-title">${escapeHtml(chat.title || "New chat")}</div>
          <button class="history-delete" type="button" data-delete-chat="${escapeHtml(chat.id)}" aria-label="Delete ${escapeHtml(chat.title || "chat")}">Delete</button>
        </div>
        <div class="history-preview">${escapeHtml(preview)}</div>
        <div class="history-footer">
          <div class="history-time">${escapeHtml(time || "Just now")}</div>
        </div>
        ${
          isConfirming
            ? `
          <div class="history-confirm">
            <button class="confirm-button cancel" type="button" data-cancel-delete="${escapeHtml(chat.id)}">Cancel</button>
            <button class="confirm-button delete" type="button" data-confirm-delete="${escapeHtml(chat.id)}">Delete</button>
          </div>
        `
            : ""
        }
      </div>
    `;
  }

  function render() {
    const activeChat = getActiveChat();
    const messages = activeChat.messages || [];
    const typingVisible =
      state.sending && state.pendingChatId === activeChat.id;
    const welcome =
      state.config?.welcome_message || "Ask anything about the site.";
    const activeTimestamp = formatTimestamp(activeChat.updatedAt) || "Just now";
    const sortedChats = [...state.chats].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    shadowRoot.innerHTML = `
      <style>${styleText()}</style>
      <button class="launcher" title="Open chat" aria-label="Open chat">
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="launcher-gradient-${chatbotId}" x1="14" y1="10" x2="54" y2="56" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#53d6ff" />
              <stop offset="1" stop-color="#5a69ff" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="30" fill="url(#launcher-gradient-${chatbotId})" />
          <path
            d="M20.5 22.5h23a8.5 8.5 0 0 1 8.5 8.5v4.5a8.5 8.5 0 0 1-8.5 8.5H33.5L24 49v-5.5h-3.5a8.5 8.5 0 0 1-8.5-8.5V31a8.5 8.5 0 0 1 8.5-8.5Z"
            fill="none"
            stroke="#f8fbff"
            stroke-width="2.8"
            stroke-linejoin="round"
          />
          <circle cx="27.5" cy="33.5" r="2.4" fill="#f8fbff" />
          <circle cx="32" cy="33.5" r="2.4" fill="#f8fbff" />
          <circle cx="36.5" cy="33.5" r="2.4" fill="#f8fbff" />
        </svg>
        <span class="sr-only">Open chat</span>
      </button>
      <section class="panel ${state.historyOpen ? "history-open" : ""}" aria-label="Chat widget">
        <div class="header">
          <div class="title">
            <strong>${escapeHtml(state.config?.name || "Chatbot")}</strong>
            <span>${escapeHtml(welcome)}</span>
          </div>
          <div class="header-actions">
            <button class="history-toggle" type="button" aria-expanded="${state.historyOpen ? "true" : "false"}" aria-label="Toggle chat history">${state.historyOpen ? "Hide history" : "History"}</button>
            <button class="new-chat" type="button" aria-label="Start a new chat">New Chat</button>
            <button class="close" type="button" title="Close chat" aria-label="Close chat">Close</button>
          </div>
        </div>
        <div class="panel-shell">
          <div class="backdrop"></div>
          <aside class="history" aria-label="Chat history">
            <div class="history-header">
              <strong>Chat history</strong>
              <span class="history-meta">${escapeHtml(String(sortedChats.length))} chat(s)</span>
            </div>
            <div class="history-list scrollable">
              ${
                sortedChats.length
                  ? sortedChats.map((chat) => renderHistoryItem(chat)).join("")
                  : '<div class="meta">No chats yet.</div>'
              }
            </div>
          </aside>
          <section class="conversation">
            <div class="conversation-header">
              <div class="summary">
                <strong>${escapeHtml(activeChat.title || "New chat")}</strong>
                <span>${escapeHtml(activeTimestamp)}</span>
              </div>
            </div>
            <div class="messages scrollable ${messages.length === 0 ? "empty" : ""}" aria-live="polite" role="log">
              ${
                messages.length === 0
                  ? `
                    <div class="empty-state">
                      <p>${escapeHtml(welcome)}</p>
                    </div>
                  `
                  : messages
                      .map(
                        (message) =>
                          `<div class="bubble ${message.role}">${escapeHtml(message.content)}</div>`,
                      )
                      .join("")
              }
              ${
                typingVisible
                  ? '<div class="typing" aria-label="Assistant is typing">Thinking</div>'
                  : ""
              }
            </div>
            ${state.error ? `<div class="error">${escapeHtml(state.error)}</div>` : ""}
            <div class="status">${state.loading ? "Loading..." : state.sending ? "Thinking..." : state.config?.is_active ? "Online" : "Offline"}</div>
            <div class="composer-wrap">
              <div class="composer">
                <textarea class="input scrollable" rows="1" placeholder="Write a message..." ${state.sending || state.loading ? "disabled" : ""}>${escapeHtml(state.input)}</textarea>
                <button class="send" ${state.sending || state.loading ? "disabled" : ""}>Send</button>
              </div>
            </div>
          </section>
        </div>
      </section>
    `;

    const launcher = shadowRoot.querySelector(".launcher");
    const close = shadowRoot.querySelector(".close");
    const historyToggle = shadowRoot.querySelector(".history-toggle");
    const newChat = shadowRoot.querySelector(".new-chat");
    const backdrop = shadowRoot.querySelector(".backdrop");
    const input = shadowRoot.querySelector(".input");
    const send = shadowRoot.querySelector(".send");
    const messagesEl = shadowRoot.querySelector(".messages");

    launcher?.addEventListener("click", openWidget);
    close?.addEventListener("click", closeWidget);
    historyToggle?.addEventListener("click", toggleHistory);
    newChat?.addEventListener("click", createNewChat);
    backdrop?.addEventListener("click", () => {
      if (state.historyOpen) {
        state.historyOpen = false;
        render();
      }
    });

    input?.addEventListener("input", (event) => {
      state.input = event.target.value;
      persistChatDraft(activeChat.id, state.input);
      resizeTextarea(event.target);
    });
    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });
    send?.addEventListener("click", sendMessage);

    shadowRoot.querySelectorAll("[data-chat-id]").forEach((item) => {
      item.addEventListener("click", () => {
        const chatId = item.getAttribute("data-chat-id");
        if (chatId) switchChat(chatId);
      });
      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          const chatId = item.getAttribute("data-chat-id");
          if (chatId) switchChat(chatId);
        }
      });
    });

    shadowRoot.querySelectorAll("[data-delete-chat]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const chatId = button.getAttribute("data-delete-chat");
        if (chatId) deleteChat(chatId);
      });
    });

    shadowRoot.querySelectorAll("[data-cancel-delete]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        state.deleteConfirmId = "";
        render();
      });
    });

    shadowRoot.querySelectorAll("[data-confirm-delete]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const chatId = button.getAttribute("data-confirm-delete");
        if (chatId) deleteChat(chatId, true);
      });
    });

    if (input) {
      requestAnimationFrame(() => {
        resizeTextarea(input);
        input.focus({ preventScroll: true });
      });
    }

    if (messagesEl && state.scrollToBottom) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
      state.scrollToBottom = false;
    }
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (state.historyOpen) {
        state.historyOpen = false;
        render();
      } else if (state.open) {
        closeWidget();
      }
    }
  });

  render();
  loadConfig();
})();
