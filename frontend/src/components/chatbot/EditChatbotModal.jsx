import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

function normalizeList(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildBaseline(chatbot) {
  return {
    name: chatbot?.name || "",
    welcomeMessage: chatbot?.welcome_message || "",
    allowedDomains: (chatbot?.allowed_domains || []).join("\n"),
    primaryContextId: chatbot?.primary_context_id || "",
    primaryColor: chatbot?.theme_config?.primary || "#c8ff57",
  };
}

function areListsEqual(left, right) {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

export default function EditChatbotModal({
  open,
  chatbot,
  contexts,
  onClose,
  onSave,
  saving,
}) {
  const [name, setName] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [allowedDomains, setAllowedDomains] = useState("");
  const [primaryContextId, setPrimaryContextId] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#c8ff57");
  const [nameError, setNameError] = useState("");
  const [contextError, setContextError] = useState("");
  const [formError, setFormError] = useState("");
  const [baseline, setBaseline] = useState(buildBaseline(null));

  useEffect(() => {
    if (!open || !chatbot) return;

    const nextBaseline = buildBaseline(chatbot);
    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) return;
      setBaseline(nextBaseline);
      setName(nextBaseline.name);
      setWelcomeMessage(nextBaseline.welcomeMessage);
      setAllowedDomains(nextBaseline.allowedDomains);
      setPrimaryContextId(nextBaseline.primaryContextId);
      setPrimaryColor(nextBaseline.primaryColor);
      setNameError("");
      setContextError("");
      setFormError("");
    });

    return () => {
      cancelled = true;
    };
  }, [open, chatbot]);

  const isDirty = useMemo(() => {
    const current = {
      name: name.trim(),
      welcomeMessage: welcomeMessage.trim(),
      allowedDomains: normalizeList(allowedDomains),
      primaryContextId,
      primaryColor: primaryColor.trim(),
    };

    const base = {
      name: baseline.name.trim(),
      welcomeMessage: baseline.welcomeMessage.trim(),
      allowedDomains: normalizeList(baseline.allowedDomains),
      primaryContextId: baseline.primaryContextId,
      primaryColor: baseline.primaryColor.trim(),
    };

    if (current.name !== base.name) return true;
    if (current.welcomeMessage !== base.welcomeMessage) return true;
    if (!areListsEqual(current.allowedDomains, base.allowedDomains)) return true;
    if (current.primaryContextId !== base.primaryContextId) return true;
    if (current.primaryColor !== base.primaryColor) return true;
    return false;
  }, [
    name,
    welcomeMessage,
    allowedDomains,
    primaryContextId,
    primaryColor,
    baseline,
  ]);

  if (!open || !chatbot) return null;

  const handleSave = () => {
    const nextName = name.trim();
    const nextPrimaryContextId = primaryContextId.trim();

    setNameError("");
    setContextError("");
    setFormError("");

    if (!nextName) {
      setNameError("Name is required.");
      setFormError("Please fix the highlighted fields.");
      return;
    }

    if (!nextPrimaryContextId) {
      setContextError("Website context is required.");
      setFormError("Please fix the highlighted fields.");
      return;
    }

    onSave(chatbot.id, {
      name: nextName,
      welcome_message: welcomeMessage.trim(),
      allowed_domains: normalizeList(allowedDomains),
      primary_context_id: nextPrimaryContextId,
      context_ids: [nextPrimaryContextId],
      theme_config: { primary: primaryColor.trim() },
    });
  };

  return (
    <div className="modal-overlay flex items-center justify-center p-4">
      <div className="modal-panel flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--hairline)] px-6 py-5">
          <div>
            <p className="text-kicker">Edit chatbot</p>
            <h2 className="text-surface-title mt-2 text-2xl font-semibold">
              {chatbot.name}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--body)]">
              Update the widget copy, website context, and primary color.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="button-secondary self-start px-3"
            aria-label="Close edit chatbot modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[color:var(--body)]">
                Name
              </label>
              <input
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (nameError) setNameError("");
                  if (formError) setFormError("");
                }}
                className="field mt-2"
                placeholder="Chatbot name"
              />
              {nameError && (
                <p className="mt-2 text-xs text-[color:var(--error)]">
                  {nameError}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[color:var(--body)]">
                Welcome message
              </label>
              <textarea
                value={welcomeMessage}
                onChange={(event) => setWelcomeMessage(event.target.value)}
                rows={3}
                className="field mt-2"
                placeholder="Message shown when the widget opens"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[color:var(--body)]">
                Allowed domains
              </label>
              <textarea
                value={allowedDomains}
                onChange={(event) => setAllowedDomains(event.target.value)}
                rows={4}
                className="field mt-2"
                placeholder="One domain per line"
              />
              <p className="mt-2 text-xs text-[color:var(--muted)]">
                Leave blank to allow all domains.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[color:var(--body)]">
                Website context
              </label>
              <select
                value={primaryContextId}
                onChange={(event) => {
                  setPrimaryContextId(event.target.value);
                  if (contextError) setContextError("");
                  if (formError) setFormError("");
                }}
                className="field mt-2"
              >
                <option value="">Select a context</option>
                {contexts.map((context) => (
                  <option key={context.id} value={context.id}>
                    {context.name || context.id}
                  </option>
                ))}
              </select>
              {contextError && (
                <p className="mt-2 text-xs text-[color:var(--error)]">
                  {contextError}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[color:var(--body)]">
                Primary color
              </label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  value={primaryColor}
                  onChange={(event) => setPrimaryColor(event.target.value)}
                  className="field"
                  placeholder="#c8ff57"
                />
                <span
                  className="h-10 w-10 shrink-0 rounded-md border border-[color:var(--hairline)]"
                  style={{ backgroundColor: primaryColor || "#000000" }}
                  aria-label="Primary color preview"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-[color:var(--hairline)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-h-5 text-sm text-[color:var(--error)]">
            {formError}
          </p>
          <div className="flex flex-wrap gap-3 sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="button-secondary justify-center"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="button-primary justify-center"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
