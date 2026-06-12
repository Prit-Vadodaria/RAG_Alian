import { useEffect, useState } from "react";
import { validatePromptSettings } from "../../utils/validatePromptSettings";

function normalizeConstraints(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function PromptSettingsModal({
  open,
  settings,
  onClose,
  onSave,
  onReset,
  onValidationError,
  saving,
}) {
  const roleValue = settings?.role || "";
  const constraintsValue = (settings?.constraints || []).join("\n");
  const [role, setRole] = useState(roleValue);
  const [constraintsText, setConstraintsText] = useState(constraintsValue);

  const handleResetDefaults = () => {
    if (onReset) {
      onReset();
      return;
    }

    setRole(roleValue);
    setConstraintsText(constraintsValue);
  };

  useEffect(() => {
    if (!open) return;
    setRole(roleValue);
    setConstraintsText(constraintsValue);
  }, [open, roleValue, constraintsValue]);

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
              placeholder="Type a custom role."
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
              placeholder="Type custom constraints, one per line."
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="button-secondary justify-center"
          >
            Reset to seed
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
              onClick={() => {
                const nextRole = role.trim();
                const nextConstraints = normalizeConstraints(constraintsText);
                const validationError = validatePromptSettings({
                  role: nextRole,
                  constraints: nextConstraints,
                });
                if (validationError) {
                  if (onValidationError) {
                    onValidationError(validationError);
                  }
                  return;
                }
                onSave({
                  role: nextRole,
                  constraints: nextConstraints,
                });
              }}
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
