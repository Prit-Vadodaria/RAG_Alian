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
    <div className="h-full min-h-0 overflow-y-auto pr-1 space-y-6">
      <div className="rounded-[2rem] border border-zinc-800 bg-[#111317] p-6 shadow-[0_40px_80px_rgba(15,23,42,0.18)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-cyan-400">
              Workspace preferences
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-zinc-100">
              Settings
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Configure your AI workspace experience, appearance options, and
              retrieval controls.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-3xl border border-zinc-800 bg-[#0f1116] px-4 py-3 text-sm text-zinc-200">
            <Cog className="h-4 w-4 text-cyan-400" />
            Workspace settings
          </div>
        </div>
      </div>

      <SectionCard title="Prompt settings">
        <div className="space-y-3">
          <label className="block text-sm text-zinc-300">Role</label>
          <textarea
            value={isEditing ? role : settings.role || ""}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-70"
            rows={3}
            disabled={isLoading || !isEditing}
          />
          <label className="block text-sm text-zinc-300">
            Additional constraints (one per line)
          </label>
          <textarea
            value={
              isEditing
                ? constraintsText
                : (settings.constraints || []).join("\n")
            }
            onChange={(e) => setConstraintsText(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-70"
            rows={6}
            disabled={isLoading || !isEditing}
          />
          <div className="flex gap-3">
            <button
              onClick={handleEdit}
              disabled={isLoading || isEditing}
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Edit
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading || !isEditing || !isDirty}
              className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save
            </button>
            <button
              onClick={handleReset}
              disabled={isLoading}
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
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
