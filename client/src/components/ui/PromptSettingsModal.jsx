import { useEffect, useRef, useState } from "react";

function normalizeConstraints(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function isUsingDefaultPromptSettings(settings, defaults) {
  const currentRole = String(settings?.role || "").trim();
  const defaultRole = String(defaults?.role || "").trim();
  const currentConstraints = normalizeConstraints(
    (settings?.constraints || []).join("\n"),
  );
  const defaultConstraints = normalizeConstraints(
    (defaults?.constraints || []).join("\n"),
  );

  if (currentRole !== defaultRole) return false;
  if (currentConstraints.length !== defaultConstraints.length) return false;
  return currentConstraints.every(
    (line, index) => line === defaultConstraints[index],
  );
}

function isDefaultRoleValue(role, defaults) {
  return String(role || "").trim() === String(defaults?.role || "").trim();
}

function isDefaultConstraintsValue(constraintsText, defaults) {
  const currentConstraints = normalizeConstraints(constraintsText || "");
  const defaultConstraints = normalizeConstraints(
    (defaults?.constraints || []).join("\n"),
  );
  if (currentConstraints.length !== defaultConstraints.length) return false;
  return currentConstraints.every((line, index) => line === defaultConstraints[index]);
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
  const baselineRef = useRef({
    role: settings.role || "",
    constraintsText: (settings.constraints || []).join("\n"),
  });

  const draftUsesDefaults = isUsingDefaultPromptSettings(
    { role, constraints: normalizeConstraints(constraintsText) },
    defaults,
  );
  const hideRoleValue = isDefaultRoleValue(role, defaults);
  const hideConstraintsValue = isDefaultConstraintsValue(constraintsText, defaults);

  const handleResetDefaults = () => {
    const defaultRole = defaults.role || "";
    const defaultConstraints = (defaults.constraints || []).join("\n");
    setRole(defaultRole);
    setConstraintsText(defaultConstraints);
    baselineRef.current = {
      role: defaultRole,
      constraintsText: defaultConstraints,
    };

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
    const nextRole = settings.role || "";
    const nextConstraintsText = (settings.constraints || []).join("\n");
    setRole(nextRole);
    setConstraintsText(nextConstraintsText);
    baselineRef.current = {
      role: nextRole,
      constraintsText: nextConstraintsText,
    };
  }, [open, settings, defaults]);

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
              value={hideRoleValue ? "" : role}
              onChange={(event) => setRole(event.target.value)}
              rows={3}
              className="field-dark mt-2 w-full px-4 py-3 text-sm"
              placeholder={
                draftUsesDefaults
                  ? "Built-in default role is active."
                  : "Type a custom role."
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[color:var(--body)]">
              Additional constraints (one per line)
            </label>
            <textarea
              value={hideConstraintsValue ? "" : constraintsText}
              onChange={(event) => setConstraintsText(event.target.value)}
              rows={5}
              className="field-dark mt-2 w-full px-4 py-3 text-sm"
              placeholder={
                draftUsesDefaults
                  ? "Built-in default constraints are active."
                  : "Type custom constraints, one per line."
              }
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-[color:var(--muted-soft)]">
          {draftUsesDefaults
            ? "Built-in defaults are active."
            : "Custom prompt settings are active."}
        </p>

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
              onClick={() => {
                const baselineRole = String(baselineRef.current.role || "").trim();
                const baselineConstraints = normalizeConstraints(
                  baselineRef.current.constraintsText || "",
                );
                const nextRole = role.trim();
                const nextConstraints = normalizeConstraints(constraintsText);
                const resolvedRole = nextRole === baselineRole ? baselineRole : nextRole;
                const resolvedConstraints =
                  nextConstraints.length === baselineConstraints.length &&
                  nextConstraints.every(
                    (line, index) => line === baselineConstraints[index],
                  )
                    ? baselineConstraints
                    : nextConstraints;
                onSave({
                  role: resolvedRole,
                  constraints: resolvedConstraints,
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
