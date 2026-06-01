import { useEffect, useState } from "react";

function normalizeConstraints(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function PromptSettingsModal({
  open,
  settings,
  defaults,
  onClose,
  onSave,
  onReset,
  saving,
}) {
  const [role, setRole] = useState(settings.role || "");
  const [constraintsText, setConstraintsText] = useState(
    (settings.constraints || []).join("\n"),
  );

  const handleResetDefaults = () => {
    const defaultRole = defaults.role || "";
    const defaultConstraints = (defaults.constraints || []).join("\n");
    setRole(defaultRole);
    setConstraintsText(defaultConstraints);

    if (onReset) {
      onReset({
        role: defaultRole,
        constraints: normalizeConstraints(defaultConstraints),
      });
      return;
    }

    onSave({
      role: defaultRole,
      constraints: normalizeConstraints(defaultConstraints),
    });
  };

  useEffect(() => {
    if (!open) return;
    setRole(settings.role || "");
    setConstraintsText((settings.constraints || []).join("\n"));
  }, [open, settings]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-[2rem] border border-zinc-800 bg-[#0b0c11] p-6 shadow-2xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-zinc-500">
              Prompt settings
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-100">
              Edit role and constraints
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="self-start rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800"
          >
            Close
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300">
              Role
            </label>
            <textarea
              value={role}
              onChange={(event) => setRole(event.target.value)}
              rows={3}
              className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-500/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300">
              Additional constraints (one per line)
            </label>
            <textarea
              value={constraintsText}
              onChange={(event) => setConstraintsText(event.target.value)}
              rows={5}
              className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-500/20"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex justify-center rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
          >
            Reset to defaults
          </button>
          <div className="flex gap-3 sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex justify-center rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                onSave({
                  role: role.trim(),
                  constraints: normalizeConstraints(constraintsText),
                })
              }
              disabled={saving}
              className="inline-flex justify-center rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
