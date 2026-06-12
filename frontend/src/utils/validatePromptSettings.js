export function validatePromptSettings(settings) {
  if (!settings?.role || !String(settings.role).trim()) return "Role cannot be empty.";
  if (
    !settings?.constraints ||
    settings.constraints.length === 0 ||
    settings.constraints.every((constraint) => !String(constraint).trim())
  ) {
    return "Constraints cannot be empty.";
  }
  return null;
}
