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

  function renderMarkdown(value) {
    const text = String(value || "").replace(/\r\n/g, "\n").trim();
    if (!text) return "";

    const formatInline = (input) => {
      const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
      return String(input || "")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(linkPattern, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    };

    const renderList = (lines, ordered = false) => {
      const tag = ordered ? "ol" : "ul";
      const items = lines
        .map((line) => {
          const cleaned = ordered
            ? line.replace(/^\d+\.\s+/, "").trim()
            : line.replace(/^[*-]\s+/, "").trim();
          return `<li>${formatInline(cleaned)}</li>`;
        })
        .join("");
      return `<${tag}>${items}</${tag}>`;
    };

    const renderBlock = (block) => {
      const lines = block.split("\n");
      const nonEmpty = lines.map((line) => line.trim()).filter(Boolean);
      if (!nonEmpty.length) return "";

      const isBullets = nonEmpty.every((line) => /^[*-]\s+/.test(line));
      if (isBullets) {
        return renderList(nonEmpty, false);
      }

      const isOrdered = nonEmpty.every((line) => /^\d+\.\s+/.test(line));
      if (isOrdered) {
        return renderList(nonEmpty, true);
      }

      return `<p>${formatInline(nonEmpty.join("<br>"))}</p>`;
    };

    const parts = [];
    const segments = text.split(/```/);

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      if (index % 2 === 1) {
        const lines = segment.split("\n");
        if (lines.length > 1 && /^[a-zA-Z0-9_-]+\s*$/.test(lines[0].trim())) {
          lines.shift();
        }
        const code = escapeHtml(lines.join("\n").replace(/^\n+|\n+$/g, ""));
        parts.push(`<pre><code>${code}</code></pre>`);
        continue;
      }

      const escaped = escapeHtml(segment);
      const paragraphs = escaped
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter(Boolean)
        .map(renderBlock)
        .filter(Boolean)
        .join("");
      if (paragraphs) {
        parts.push(paragraphs);
      }
    }

    return parts.join("");
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
  const themeKey = `rag-widget-theme-${chatbotId}`;
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

  function loadThemePreference() {
    try {
      const stored = localStorage.getItem(themeKey);
      return stored === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  }

  function saveThemePreference(theme) {
    try {
      localStorage.setItem(themeKey, theme);
    } catch {
      // ignore storage errors
    }
  }

  function getThemePalette() {
    const themeConfig = state.config?.theme || {};
    const primary = themeConfig.primary || "#0099ff";
    if (state.theme === "light") {
      return {
        canvas: "#ffffff",
        surface1: "#f8f8f8",
        surface2: "#ededed",
        text: "#111111",
        textMuted: "#666666",
        primary,
        error: primary,
        border: "#dddddd",
        borderSoft: "#e9e9e9",
        shadow: "rgba(0, 0, 0, 0.12)",
        shadowStrong: "rgba(0, 0, 0, 0.18)",
        userSolid: primary,
        userText: "#ffffff",
        mutedBg: "rgba(0, 0, 0, 0.03)",
        overlay: "rgba(17, 17, 17, 0.08)",
      };
    }
    return {
      canvas: "#000000",
      surface1: "#111111",
      surface2: "#1a1a1a",
      text: "#ffffff",
      textMuted: "#999999",
      primary,
      error: primary,
      border: "#262626",
      borderSoft: "#1a1a1a",
      shadow: "rgba(0, 0, 0, 0.42)",
      shadowStrong: "rgba(0, 0, 0, 0.56)",
      userSolid: primary,
      userText: "#ffffff",
      mutedBg: "rgba(255, 255, 255, 0.04)",
      overlay: "rgba(0, 0, 0, 0.38)",
    };
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
    theme: loadThemePreference(),
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
  saveThemePreference(state.theme);

  function toggleTheme() {
    state.theme = state.theme === "dark" ? "light" : "dark";
    saveThemePreference(state.theme);
    render();
  }

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
        appendMessage(chatId, "assistant", response.answer);
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
    textarea.style.overflowY = textarea.scrollHeight > 40 ? "auto" : "hidden";
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
    const palette = getThemePalette();

    return `
      :host {
        all: initial;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        --canvas: ${palette.canvas};
        --surface-1: ${palette.surface1};
        --surface-2: ${palette.surface2};
        --text: ${palette.text};
        --text-muted: ${palette.textMuted};
        --primary: ${palette.primary};
        --error: ${palette.error};
        --border: ${palette.border};
        --border-soft: ${palette.borderSoft};
        --shadow: ${palette.shadow};
        --shadow-strong: ${palette.shadowStrong};
        --user-solid: ${palette.userSolid};
        --user-text: ${palette.userText};
        --muted-bg: ${palette.mutedBg};
        --overlay: ${palette.overlay};
        --history-width: 320px;
        --radius-xs: 10px;
        --radius-sm: 14px;
        --radius-md: 18px;
        --radius-lg: 24px;
        --radius-xl: 28px;
        --radius-pill: 999px;
      }
      * {
        box-sizing: border-box;
      }
      :host([data-theme="light"]) {
        color-scheme: light;
      }
      :host([data-theme="dark"]) {
        color-scheme: dark;
      }
      .launcher {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 2147483647;
        width: 60px;
        height: 60px;
        border: none;
        border-radius: var(--radius-pill);
        background: transparent;
        color: var(--user-text);
        box-shadow: 0 16px 40px var(--shadow);
        cursor: pointer;
        display: ${state.open ? "none" : "grid"};
        place-items: center;
        padding: 0;
        transition: transform 180ms ease, box-shadow 180ms ease, filter 180ms ease;
        outline: none;
      }
      .launcher svg {
        width: 60px;
        height: 60px;
        display: block;
        filter: drop-shadow(0 14px 26px rgba(0, 0, 0, 0.22));
      }
      .launcher-dot {
        transform-box: fill-box;
        transform-origin: center;
        animation: launcherDotPulse 2.2s ease-in-out infinite;
      }
      .launcher-dot.dot-1 {
        animation-delay: 0s;
      }
      .launcher-dot.dot-2 {
        animation-delay: 0.16s;
      }
      .launcher-dot.dot-3 {
        animation-delay: 0.32s;
      }
      .launcher:hover {
        transform: translateY(-2px) scale(1.02);
        box-shadow: 0 20px 50px var(--shadow-strong);
        filter: brightness(1.04);
      }
      .launcher:focus-visible {
        outline: 2px solid color-mix(in srgb, var(--primary) 70%, white);
        outline-offset: 4px;
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
      @keyframes launcherDotPulse {
        0%, 100% {
          transform: translateY(0) scale(1);
          opacity: 0.92;
        }
        50% {
          transform: translateY(-1.5px) scale(1.08);
          opacity: 1;
        }
      }
      .panel {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 2147483647;
        width: min(440px, calc(100vw - 36px));
        height: min(700px, calc(100vh - 36px));
        border-radius: var(--radius-xl);
        overflow: hidden;
        display: ${state.open ? "flex" : "none"};
        flex-direction: column;
        background: var(--canvas);
        color: var(--text);
        border: 1px solid var(--border);
        box-shadow: 0 28px 90px var(--shadow-strong);
        backdrop-filter: blur(18px);
      }
      .panel-shell {
        position: relative;
        flex: 1;
        display: flex;
        min-height: 0;
        overflow: hidden;
      }
      .header {
        padding: 14px 14px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        background: var(--canvas);
        border-bottom: 1px solid var(--border);
        backdrop-filter: blur(12px);
      }
      .title {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
      }
      .title strong {
        font-size: 14px;
        line-height: 1.15;
        letter-spacing: -0.03em;
        font-weight: 700;
      }
      .title span,
      .meta,
      .status {
        font-size: 12px;
        color: var(--text-muted);
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
      .theme-toggle,
      .close,
      .new-chat,
      .history-toggle,
      .history-item,
      .history-action,
      .confirm-button,
      .send {
        border: none;
        outline: none;
        transition: transform 180ms ease, background 180ms ease, border-color 180ms ease, opacity 180ms ease, color 180ms ease, box-shadow 180ms ease, filter 180ms ease;
      }
      .chip,
      .icon-button,
      .theme-toggle,
      .close,
      .new-chat,
      .history-toggle {
        border-radius: var(--radius-pill);
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
      .theme-toggle:focus-visible,
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
        background: var(--surface-1);
        color: var(--text);
        border: 1px solid var(--border);
      }
      .new-chat {
        background: var(--primary);
        border-color: var(--primary);
        color: #ffffff;
      }
      .history-toggle:hover,
      .new-chat:hover,
      .close:hover,
      .icon-button:hover,
      .theme-toggle:hover,
      .chip:hover,
      .confirm-button:hover,
      .send:hover {
        transform: translateY(-1px);
      }
      .close {
        min-width: 34px;
        height: 34px;
        background: var(--surface-1);
        color: var(--text);
        border: 1px solid var(--border);
      }
      .theme-toggle {
        min-width: 34px;
        height: 34px;
        background: var(--surface-1);
        color: var(--text);
        border: 1px solid var(--border);
      }
      .theme-toggle svg {
        width: 14px;
        height: 14px;
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
        background: var(--surface-1);
        border-right: 1px solid var(--border);
        box-shadow: 16px 0 42px var(--shadow);
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
        color: var(--text-muted);
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
        border-radius: var(--radius-md);
        background: var(--surface-2);
        border: 1px solid var(--border);
        color: var(--text);
        margin-bottom: 10px;
        cursor: pointer;
      }
      .history-item:hover {
        background: color-mix(in srgb, var(--surface-2) 75%, var(--text) 5%);
        border-color: color-mix(in srgb, var(--border) 65%, var(--primary) 35%);
      }
      .history-item.active {
        background: color-mix(in srgb, var(--surface-2) 90%, var(--primary) 10%);
        border-color: color-mix(in srgb, var(--primary) 55%, var(--border) 45%);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary) 18%, transparent);
      }
      .history-item.delete-confirm {
        border-color: color-mix(in srgb, var(--primary) 45%, var(--border) 55%);
        background: color-mix(in srgb, var(--surface-2) 82%, var(--primary) 18%);
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
        color: var(--text-muted);
      }
      .history-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .history-time {
        font-size: 11px;
        color: var(--text-muted);
      }
      .history-delete {
        opacity: 0;
        pointer-events: none;
        min-height: 28px;
        padding: 0 10px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--primary) 12%, transparent);
        color: color-mix(in srgb, var(--primary) 30%, white);
        border: 1px solid color-mix(in srgb, var(--primary) 18%, transparent);
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
        background: var(--surface-1);
        color: var(--text);
        border: 1px solid var(--border);
      }
      .confirm-button.delete {
        background: color-mix(in srgb, var(--primary) 16%, transparent);
        color: color-mix(in srgb, var(--primary) 32%, white);
        border: 1px solid color-mix(in srgb, var(--primary) 22%, transparent);
      }
      .backdrop {
        position: absolute;
        inset: 0;
        background: var(--overlay);
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
        border-bottom: 1px solid var(--border);
        background: var(--canvas);
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
        color: var(--text-muted);
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
        border-radius: var(--radius-lg);
        border: 1px solid var(--border);
        background: var(--surface-2);
        color: var(--text);
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
        color: var(--text-muted);
      }
      .bubble {
        max-width: min(86%, 36rem);
        padding: 12px 14px;
        border-radius: 20px;
        line-height: 1.55;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 13px;
        letter-spacing: -0.01em;
      }
      .user {
        align-self: flex-end;
        background: var(--user-solid);
        color: var(--user-text);
        border-bottom-right-radius: 7px;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
      }
      .assistant {
        align-self: flex-start;
        background: var(--surface-2);
        color: var(--text);
        border: 1px solid var(--border);
        border-bottom-left-radius: 7px;
      }
      .typing {
        align-self: flex-start;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        min-height: 38px;
        padding: 10px 14px 10px 12px;
        border-radius: 18px;
        background: var(--surface-2);
        border: 1px solid var(--border);
        color: var(--text-muted);
        font-size: 12px;
      }
      .typing-dots {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-right: 2px;
        flex: 0 0 auto;
      }
      .typing-dots span {
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: var(--primary);
        opacity: 0.85;
        animation: typingDotPulse 1.2s ease-in-out infinite;
      }
      .typing-dots span:nth-child(2) {
        animation-delay: 0.16s;
      }
      .typing-dots span:nth-child(3) {
        animation-delay: 0.32s;
      }
      .typing-label {
        line-height: 1;
      }
      @keyframes typingDotPulse {
        0%, 80%, 100% {
          transform: translateY(0);
          opacity: 0.45;
        }
        40% {
          transform: translateY(-2px);
          opacity: 1;
        }
      }
      .composer-wrap {
        padding: 12px;
        border-top: 1px solid var(--border);
        background: var(--canvas);
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
        max-height: 120px;
        resize: none;
        border: 1px solid var(--border);
        border-radius: 16px;
        background: var(--surface-2);
        color: var(--text);
        padding: 11px 12px;
        outline: none;
        font: inherit;
        line-height: 1.45;
        scrollbar-gutter: stable;
        transition: border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
      }
      .input::placeholder {
        color: var(--text-muted);
      }
      .input:focus {
        border-color: var(--primary);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent);
        background: var(--surface-2);
      }
      .send {
        min-width: 62px;
        height: 40px;
        padding: 0 14px;
        border-radius: 14px;
        background: var(--primary);
        color: #ffffff;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 10px 24px color-mix(in srgb, var(--primary) 18%, transparent);
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
        color: var(--error);
      }
      .scrollable {
        scrollbar-width: thin;
        scrollbar-color: color-mix(in srgb, var(--text-muted) 55%, transparent) color-mix(in srgb, var(--canvas) 88%, var(--surface-1));
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
      }
      .scrollable::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      .scrollable::-webkit-scrollbar-track {
        background: color-mix(in srgb, var(--canvas) 88%, var(--surface-1));
        border-radius: 999px;
      }
      .scrollable::-webkit-scrollbar-thumb {
        background: color-mix(in srgb, var(--text-muted) 55%, transparent);
        border-radius: 999px;
        border: 2px solid color-mix(in srgb, var(--canvas) 88%, var(--surface-1));
      }
      .scrollable::-webkit-scrollbar-thumb:hover {
        background: color-mix(in srgb, var(--text-muted) 72%, transparent);
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
    rootHost.setAttribute("data-theme", state.theme);

    shadowRoot.innerHTML = `
      <style>${styleText()}</style>
      <button class="launcher" title="Open chat" aria-label="Open chat">
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <circle cx="32" cy="32" r="30" fill="var(--primary)" />
          <path
            d="M20.5 22.5h23a8.5 8.5 0 0 1 8.5 8.5v4.5a8.5 8.5 0 0 1-8.5 8.5H33.5L24 49v-5.5h-3.5a8.5 8.5 0 0 1-8.5-8.5V31a8.5 8.5 0 0 1 8.5-8.5Z"
            fill="none"
            stroke="var(--user-text)"
            stroke-width="2.8"
            stroke-linejoin="round"
          />
          <circle class="launcher-dot dot-1" cx="26.5" cy="33.5" r="2.4" fill="var(--user-text)" />
          <circle class="launcher-dot dot-2" cx="32" cy="33.5" r="2.4" fill="var(--user-text)" />
          <circle class="launcher-dot dot-3" cx="37.5" cy="33.5" r="2.4" fill="var(--user-text)" />
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
            <button class="theme-toggle" type="button" aria-label="Toggle theme" aria-pressed="${state.theme === "light" ? "true" : "false"}" title="Toggle theme">
              ${
                state.theme === "light"
                  ? `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-14h1v3h-1V3Zm0 18h1v-3h-1v3ZM4.2 5.6l2.1 2.1-.7.7-2.1-2.1.7-.7Zm14.2 14.2 2.1 2.1.7-.7-2.1-2.1-.7.7ZM3 13h3v-1H3v1Zm18 0h-3v-1h3v1ZM5.6 19.8l2.1-2.1.7.7-2.1 2.1-.7-.7Zm14.2-14.2-2.1 2.1-.7-.7 2.1-2.1.7.7Z"/></svg>`
                  : `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20 14.6A8.5 8.5 0 0 1 9.4 4a7.9 7.9 0 1 0 10.6 10.6Z"/></svg>`
              }
            </button>
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
                        `<div class="bubble ${message.role}">${renderMarkdown(message.content)}</div>`,
                      )
                      .join("")
              }
              ${
                typingVisible
                  ? '<div class="typing" aria-label="Assistant is typing"><span class="typing-dots" aria-hidden="true"><span></span><span></span><span></span></span><span class="typing-label">Thinking</span></div>'
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
    const themeToggle = shadowRoot.querySelector(".theme-toggle");
    const historyToggle = shadowRoot.querySelector(".history-toggle");
    const newChat = shadowRoot.querySelector(".new-chat");
    const backdrop = shadowRoot.querySelector(".backdrop");
    const input = shadowRoot.querySelector(".input");
    const send = shadowRoot.querySelector(".send");
    const messagesEl = shadowRoot.querySelector(".messages");

    launcher?.addEventListener("click", openWidget);
    close?.addEventListener("click", closeWidget);
    themeToggle?.addEventListener("click", toggleTheme);
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
