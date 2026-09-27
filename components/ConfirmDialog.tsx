import { useEffect, useRef } from "react";
import { AlertCircle } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      onCancel={onCancel}
      className="p-0 rounded-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm shadow-xl w-full max-w-md m-auto border border-border"
      style={{ background: "var(--bg-card)", color: "var(--text-primary)" }}
    >
      <div className="p-6">
        <div className="flex gap-4 items-start mb-6">
          <div className={`p-2 rounded-full shrink-0 ${isDestructive ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-500' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-500'}`}>
            <AlertCircle size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {message}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: "var(--text-secondary)" }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white"
            style={{ background: isDestructive ? "var(--danger)" : "var(--accent)" }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
