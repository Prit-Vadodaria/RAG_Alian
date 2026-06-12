import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Cog,
  Loader2,
  Plus,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";

import ConfirmDialog from "../components/ui/ConfirmDialog";
import SectionCard from "../components/ui/SectionCard";
import { usePromptSettingsStore } from "../store/promptSettingsStore";
import { useContextStore } from "../store/contextStore";
import {
  createChatbot,
  deleteChatbot,
  disableChatbot,
  enableChatbot,
  getChatbotEmbed,
  listChatbots,
} from "../services/chatbots";

function normalizeDomains(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function Chatbots() {
  const { settings, loadSettings } = usePromptSettingsStore();
  const { contexts, fetchContexts, showToast, selectedContext } =
    useContextStore();
  const availableContexts = useMemo(
    () =>
      contexts.filter((context) =>
        ["ready", "partially_ready"].includes(
          String(context.status || "").toLowerCase(),
        ),
      ),
    [contexts],
  );

  const [chatbots, setChatbots] = useState([]);
  const [chatbotName, setChatbotName] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [allowedDomains, setAllowedDomains] = useState("");
  const [primaryContextId, setPrimaryContextId] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#c8ff57");
  const [isChatbotsLoading, setIsChatbotsLoading] = useState(false);
  const [isChatbotSaving, setIsChatbotSaving] = useState(false);
  const [chatbotError, setChatbotError] = useState("");
  const [confirmChatbot, setConfirmChatbot] = useState(null);
  const [copiedSnippetId, setCopiedSnippetId] = useState("");

  useEffect(() => {
    loadSettings();
    fetchContexts();
    refreshChatbots();
  }, [fetchContexts, loadSettings]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      refreshChatbots();
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (
      selectedContext &&
      availableContexts.some((context) => context.id === selectedContext)
    ) {
      setPrimaryContextId(selectedContext);
    } else {
      setPrimaryContextId(availableContexts[0]?.id || "");
    }
  }, [availableContexts, selectedContext]);

  async function refreshChatbots() {
    setIsChatbotsLoading(true);
    try {
      const items = await listChatbots();
      setChatbots(items);
      setChatbotError("");
    } catch (error) {
      setChatbotError(error.message || String(error));
    } finally {
      setIsChatbotsLoading(false);
    }
  }

  const handleCreateChatbot = async () => {
    if (!chatbotName.trim()) {
      showToast("Chatbot name is required.", "error");
      return;
    }
    if (!primaryContextId) {
      showToast("Select a website context first.", "error");
      return;
    }

    setIsChatbotSaving(true);
    try {
      await createChatbot({
        name: chatbotName.trim(),
        welcome_message: welcomeMessage.trim(),
        allowed_domains: normalizeDomains(allowedDomains),
        primary_context_id: primaryContextId,
        context_ids: [primaryContextId],
        theme_config: {
          primary: primaryColor,
        },
        prompt_config: {
          role: settings?.role || "",
          tone: settings?.tone || "friendly",
          answer_style: settings?.answer_style || "professional",
          fallback_behavior: settings?.fallback_behavior || "helpful",
          strict_grounding: settings?.strict_grounding ?? true,
          allow_inference: settings?.allow_inference ?? true,
          website_identity_mode: settings?.website_identity_mode ?? true,
          constraints: settings?.constraints || [],
        },
      });
      setChatbotName("");
      setWelcomeMessage("");
      setAllowedDomains("");
      setPrimaryContextId(availableContexts[0]?.id || "");
      await refreshChatbots();
      showToast("Chatbot created.", "success");
    } catch (error) {
      setChatbotError(error.message || String(error));
      showToast(`Failed to create chatbot: ${error.message}`, "error");
    } finally {
      setIsChatbotSaving(false);
    }
  };

  const handleToggleChatbot = async (chatbot) => {
    try {
      if (chatbot.is_active) {
        await disableChatbot(chatbot.id);
      } else {
        await enableChatbot(chatbot.id);
      }
      await refreshChatbots();
      showToast(
        `Chatbot ${chatbot.is_active ? "disabled" : "enabled"}.`,
        "success",
      );
    } catch (error) {
      showToast(`Failed to update chatbot: ${error.message}`, "error");
    }
  };

  const handleDeleteChatbot = async () => {
    if (!confirmChatbot) return;
    try {
      await deleteChatbot(confirmChatbot.id);
      await refreshChatbots();
      setConfirmChatbot(null);
      showToast("Chatbot disabled.", "success");
    } catch (error) {
      showToast(`Failed to disable chatbot: ${error.message}`, "error");
    }
  };

  const handleCopySnippet = async (chatbotId) => {
    try {
      const result = await getChatbotEmbed(chatbotId);
      await navigator.clipboard.writeText(result.snippet);
      setCopiedSnippetId(chatbotId);
      showToast("Embed snippet copied.", "success");
      window.setTimeout(() => setCopiedSnippetId(""), 1500);
    } catch (error) {
      showToast(`Failed to copy snippet: ${error.message}`, "error");
    }
  };

  return (
    <div className="h-full min-h-0 space-y-6 overflow-y-auto pr-1">
      <div className="surface-page p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-kicker">Deployment</p>
            <h1 className="text-surface-title mt-3 text-3xl font-semibold sm:text-4xl">
              Chatbot deployment
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--body)]">
              Create and export the embeddable chatbot widget.
            </p>
          </div>
          <div className="surface-card inline-flex items-center gap-2 px-4 py-3 text-sm text-[color:var(--body)]">
            <Cog className="h-4 w-4 text-[color:var(--primary)]" />
            Widget manager
          </div>
        </div>
      </div>

      <SectionCard title="Deployed chatbots">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-[color:var(--body)]">
              Copy the embed snippet or disable a bot globally.
            </p>
            {isChatbotsLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-[color:var(--muted)]" />
            )}
          </div>
          {chatbots.length === 0 && (
            <p className="text-sm text-[color:var(--body)]">
              No chatbots created yet.
            </p>
          )}
          {chatbots.map((chatbot) => (
            <div key={chatbot.id} className="surface-card p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-[color:var(--ink)]">
                      {chatbot.name}
                    </p>
                    <span className="token-pill text-[10px] uppercase tracking-[0.24em]">
                      {chatbot.is_active ? "active" : "disabled"}
                    </span>
                    {chatbot.is_active ? (
                      <Check className="h-4 w-4 text-[color:var(--success)]" />
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-[color:var(--muted)]">
                    {chatbot.id}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--primary-strong)]">
                    namespace: {chatbot.namespace}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--body)]">
                    context: {chatbot.primary_context_id || "unassigned"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleChatbot(chatbot)}
                    className="button-secondary px-4 py-2"
                  >
                    {chatbot.is_active ? (
                      <PowerOff className="h-4 w-4" />
                    ) : (
                      <Power className="h-4 w-4" />
                    )}
                    {chatbot.is_active ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopySnippet(chatbot.id)}
                    className="button-secondary px-4 py-2"
                  >
                    {copiedSnippetId === chatbot.id ? (
                      <Check className="h-4 w-4 text-[color:var(--success)]" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    Copy snippet
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmChatbot(chatbot)}
                    className="button-danger px-4 py-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Create chatbot">
        <div className="space-y-5">
          <p className="text-sm text-[color:var(--body)]">
            Create a multi-tenant public chatbot that is served only through the
            orchestrator.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={chatbotName}
              onChange={(event) => setChatbotName(event.target.value)}
              placeholder="Chatbot name"
              className="field"
              disabled={isChatbotSaving}
            />
            <select
              value={primaryContextId}
              onChange={(event) => setPrimaryContextId(event.target.value)}
              className="field"
              disabled={isChatbotSaving}
            >
              {availableContexts.map((context) => (
                <option key={context.id} value={context.id}>
                  {context.name || context.id}
                </option>
              ))}
            </select>
            <textarea
              value={welcomeMessage}
              onChange={(event) => setWelcomeMessage(event.target.value)}
              placeholder="Welcome message"
              rows={3}
              className="field md:col-span-2"
              disabled={isChatbotSaving}
            />
            <textarea
              value={allowedDomains}
              onChange={(event) => setAllowedDomains(event.target.value)}
              placeholder="Allowed domains, one per line (leave blank to allow all)"
              rows={3}
              className="field md:col-span-2"
              disabled={isChatbotSaving}
            />
            <label className="block space-y-2 md:col-span-2">
              <span className="text-sm text-[color:var(--body)]">
                Primary color
              </span>
              <input
                value={primaryColor}
                onChange={(event) => setPrimaryColor(event.target.value)}
                placeholder="var(--primary)"
                className="field w-full"
                disabled={isChatbotSaving}
              />
              <p className="text-xs text-[color:var(--muted)]">
                This single color is used only on important widget moments like
                the launcher, send button, focus state, and selected items.
              </p>
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCreateChatbot}
              disabled={isChatbotSaving}
              className="button-primary"
            >
              {isChatbotSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create chatbot
            </button>
            {chatbotError && (
              <p className="text-sm text-[color:var(--error)]">
                {chatbotError}
              </p>
            )}
          </div>
        </div>
      </SectionCard>

      <ConfirmDialog
        open={Boolean(confirmChatbot)}
        title="Delete chatbot"
        description={
          confirmChatbot
            ? `Disable chatbot '${confirmChatbot.name}' globally? The widget will stop answering immediately.`
            : ""
        }
        confirmText="Delete"
        cancelText="Cancel"
        loading={false}
        onConfirm={handleDeleteChatbot}
        onCancel={() => setConfirmChatbot(null)}
      />
    </div>
  );
}

export default Chatbots;
