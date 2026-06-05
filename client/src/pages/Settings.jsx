import { useEffect, useMemo, useState } from "react";
import { Cog } from "lucide-react";
import SectionCard from "../components/ui/SectionCard";
import ContextManager from "../components/context/ContextManager";
import { usePromptSettingsStore } from "../store/promptSettingsStore";
import { useContextStore } from "../store/contextStore";

function normalizeConstraints(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function Settings() {
  const { settings, loadSettings, saveSettings, resetSettings, isLoading } =
    usePromptSettingsStore();
  const showToast = useContextStore((state) => state.showToast);

  const [role, setRole] = useState("");
  const [constraintsText, setConstraintsText] = useState("");
  const [isEditing, setIsEditing] = useState(false);

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

    const constraints = normalizeConstraints(constraintsText);
    await saveSettings({ role: role.trim(), constraints });
    setIsEditing(false);
    showToast("Prompt settings saved.", "success");
  };

  const handleReset = async () => {
    const next = await resetSettings();
    setRole(next.role || "");
    setConstraintsText((next.constraints || []).join("\n"));
    setIsEditing(false);
    showToast("Prompt settings reset to defaults.", "success");
  };

  const handleEdit = () => {
    setRole(settings.role || "");
    setConstraintsText((settings.constraints || []).join("\n"));
    setIsEditing(true);
  };

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
            value={isEditing ? role : settings.role || ""}
            onChange={(e) => setRole(e.target.value)}
            className="field"
            rows={3}
            disabled={isLoading || !isEditing}
          />
          <label className="block text-sm text-[color:var(--body)]">
            Additional constraints (one per line)
          </label>
          <textarea
            value={
              isEditing
                ? constraintsText
                : (settings.constraints || []).join("\n")
            }
            onChange={(e) => setConstraintsText(e.target.value)}
            className="field"
            rows={6}
            disabled={isLoading || !isEditing}
          />
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
