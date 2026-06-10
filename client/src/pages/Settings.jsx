import { useEffect, useMemo, useRef, useState } from "react";
import { Cog } from "lucide-react";
import SectionCard from "../components/ui/SectionCard";
import ContextManager from "../components/context/ContextManager";
import {
  DEFAULT_PROMPT_SETTINGS,
  usePromptSettingsStore,
} from "../store/promptSettingsStore";
import { useContextStore } from "../store/contextStore";

function normalizeConstraints(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function isUsingDefaultPromptSettings(settings) {
  const currentRole = String(settings?.role || "").trim();
  const defaultRole = String(DEFAULT_PROMPT_SETTINGS.role || "").trim();
  const currentConstraints = normalizeConstraints(
    (settings?.constraints || []).join("\n"),
  );
  const defaultConstraints = normalizeConstraints(
    (DEFAULT_PROMPT_SETTINGS.constraints || []).join("\n"),
  );

  if (currentRole !== defaultRole) return false;
  if (currentConstraints.length !== defaultConstraints.length) return false;
  return currentConstraints.every(
    (line, index) => line === defaultConstraints[index],
  );
}

function isDefaultRoleValue(role) {
  return String(role || "").trim() === String(DEFAULT_PROMPT_SETTINGS.role || "").trim();
}

function isDefaultConstraintsValue(constraintsText) {
  const currentConstraints = normalizeConstraints(constraintsText || "");
  const defaultConstraints = normalizeConstraints(
    (DEFAULT_PROMPT_SETTINGS.constraints || []).join("\n"),
  );
  if (currentConstraints.length !== defaultConstraints.length) return false;
  return currentConstraints.every((line, index) => line === defaultConstraints[index]);
}

function Settings() {
  const { settings, loadSettings, saveSettings, resetSettings, isLoading } =
    usePromptSettingsStore();
  const showToast = useContextStore((state) => state.showToast);

  const [role, setRole] = useState("");
  const [constraintsText, setConstraintsText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [saveError, setSaveError] = useState("");
  const editBaselineRef = useRef({
    role: "",
    constraintsText: "",
  });
  const usingDefaults = isUsingDefaultPromptSettings(settings);

  useEffect(() => {
    loadSettings();
    if (window.location.hash === "#knowledge-contexts") {
      document
        .getElementById("knowledge-contexts")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loadSettings]);

  const isDirty = useMemo(() => {
    const currentRole = role.trim();
    const baseRole = (settings.role || "").trim();

    const currentConstraints = normalizeConstraints(constraintsText);
    const baseConstraints = (settings.constraints || []).map((line) =>
      String(line).trim(),
    );

    if (currentRole !== baseRole) return true;
    if (currentConstraints.length !== baseConstraints.length) return true;

    for (let i = 0; i < currentConstraints.length; i += 1) {
      if (currentConstraints[i] !== baseConstraints[i]) return true;
    }
    return false;
  }, [role, constraintsText, settings]);

  const handleSave = async () => {
    if (!isEditing || !isDirty) return;

    const baselineRole = String(editBaselineRef.current.role || "").trim();
    const baselineConstraints = normalizeConstraints(
      editBaselineRef.current.constraintsText || "",
    );
    const nextRole = role.trim();
    const nextConstraints = normalizeConstraints(constraintsText);
    const constraints =
      nextConstraints.length === baselineConstraints.length &&
      nextConstraints.every((line, index) => line === baselineConstraints[index])
        ? baselineConstraints
        : nextConstraints;
    const resolvedRole = nextRole === baselineRole ? baselineRole : nextRole;
    setSaveError("");
    try {
      await saveSettings({ role: resolvedRole, constraints });
      setIsEditing(false);
      showToast("Prompt settings saved.", "success");
    } catch (error) {
      const message = error.message || String(error);
      setSaveError(message);
      showToast(`Failed to save prompt settings: ${message}`, "error");
    }
  };

  const handleReset = async () => {
    setSaveError("");
    try {
      const next = await resetSettings();
      setRole(next.role || "");
      setConstraintsText((next.constraints || []).join("\n"));
      editBaselineRef.current = {
        role: next.role || "",
        constraintsText: (next.constraints || []).join("\n"),
      };
      setIsEditing(false);
      showToast("Prompt settings reset to defaults.", "success");
    } catch (error) {
      const message = error.message || String(error);
      setSaveError(message);
      showToast(`Failed to reset prompt settings: ${message}`, "error");
    }
  };

  const handleEdit = () => {
    const nextRole = settings.role || "";
    const nextConstraintsText = (settings.constraints || []).join("\n");
    setRole(nextRole);
    setConstraintsText(nextConstraintsText);
    editBaselineRef.current = {
      role: nextRole,
      constraintsText: nextConstraintsText,
    };
    setIsEditing(true);
  };

  const showRoleValue = !isEditing || !isDefaultRoleValue(role) ? role : "";
  const showConstraintsValue = !isEditing || !isDefaultConstraintsValue(constraintsText)
    ? constraintsText
    : "";

  return (
    <div className="h-full min-h-0 space-y-6 overflow-y-auto pr-1">
      <div className="surface-page p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-kicker">Workspace preferences</p>
            <h1 className="text-surface-title mt-3 text-3xl font-semibold sm:text-4xl">
              Settings
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--body)]">
              Configure your AI workspace experience, appearance options, and retrieval
              controls.
            </p>
          </div>
          <div className="surface-card inline-flex items-center gap-2 px-4 py-3 text-sm text-[color:var(--body)]">
            <Cog className="h-4 w-4 text-[color:var(--primary)]" />
            Workspace settings
          </div>
        </div>
      </div>

      <SectionCard title="Prompt settings">
        <div className="space-y-3">
          <label className="block text-sm text-[color:var(--body)]">Role</label>
          <textarea
            value={showRoleValue}
            onChange={(e) => setRole(e.target.value)}
            className="field"
            rows={3}
            placeholder={
              usingDefaults
                ? "Built-in default role is active."
                : "No role configured."
            }
            disabled={isLoading || !isEditing}
          />
          <label className="block text-sm text-[color:var(--body)]">
            Additional constraints (one per line)
          </label>
          <textarea
            value={showConstraintsValue}
            onChange={(e) => setConstraintsText(e.target.value)}
            className="field"
            rows={6}
            placeholder={
              usingDefaults
                ? "Built-in default constraints are active."
                : "No custom constraints configured."
            }
            disabled={isLoading || !isEditing}
          />
          <p className="text-xs text-[color:var(--muted)]">
            {usingDefaults
              ? "Built-in defaults are active."
              : "Custom prompt settings are active."}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleEdit}
              disabled={isLoading || isEditing}
              className="button-secondary"
            >
              Edit
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading || !isEditing || !isDirty}
              className="button-primary"
            >
              Save
            </button>
            <button
              onClick={handleReset}
              disabled={isLoading}
              className="button-secondary"
            >
              Reset Defaults
            </button>
          </div>
          {saveError && (
            <p className="text-sm text-[color:var(--error)]">{saveError}</p>
          )}
        </div>
      </SectionCard>

      <div id="knowledge-contexts" className="scroll-mt-6">
        <SectionCard title="Knowledge contexts">
          <ContextManager />
        </SectionCard>
      </div>
    </div>
  );
}

export default Settings;
