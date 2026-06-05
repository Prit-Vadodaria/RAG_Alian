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
    <div className="modal-overlay flex items-center justify-center p-4">
      <div className="modal-panel w-full max-w-2xl p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-kicker">
              Prompt settings
            </p>
            <h2 className="text-surface-title mt-2 text-2xl font-semibold">
              Edit role and constraints
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="button-secondary self-start"
          >
            Close
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[color:var(--body)]">
              Role
            </label>
            <textarea
              value={role}
              onChange={(event) => setRole(event.target.value)}
              rows={3}
              className="field-dark mt-2 w-full px-4 py-3 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[color:var(--body)]">
              Additional constraints (one per line)
            </label>
            <textarea
              value={constraintsText}
              onChange={(event) => setConstraintsText(event.target.value)}
              rows={5}
              className="field-dark mt-2 w-full px-4 py-3 text-sm"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="button-secondary justify-center"
          >
            Reset to defaults
          </button>
          <div className="flex gap-3 sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="button-secondary justify-center"
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
              className="button-primary justify-center"
            >
              {saving ? "Saving..." : "Save settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
