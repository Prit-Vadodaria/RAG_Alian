export default function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  loading = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="modal-overlay flex items-center justify-center px-4 py-6">
      <div className="modal-panel w-full max-w-md p-6">
        <div className="space-y-4">
          <div>
            <p className="text-kicker">
              {title}
            </p>
            <p className="mt-3 text-sm leading-6 text-[color:var(--body)]">
              {description}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="button-secondary justify-center"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="button-danger justify-center"
            >
              {loading ? "Deleting..." : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
