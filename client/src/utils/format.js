export const createChatTitle = (text) => {
  const sanitized = text.trim().replace(/\s+/g, " ");
  if (!sanitized) {
    return "New conversation";
  }
  const preview = sanitized.split(" ").slice(0, 6).join(" ");
  return preview.length > 40 ? `${preview.slice(0, 37)}...` : preview;
};

export const formatDateLabel = (isoString) => {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

export const formatTime = (isoString) => {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatDuration = (millis) => {
  if (!millis && millis !== 0) {
    return "—";
  }
  return `${(millis / 1000).toFixed(1)}s`;
};
