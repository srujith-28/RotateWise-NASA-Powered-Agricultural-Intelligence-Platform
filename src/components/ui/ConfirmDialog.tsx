import { AlertTriangle, X } from 'lucide-react';
import { useEffect } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#17231E]/45 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl border border-[#E1E8E2] bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                tone === 'danger'
                  ? 'bg-[#FEF2F2] text-[#B91C1C]'
                  : 'bg-[#EAF2EC] text-[#174C3C]'
              }`}
            >
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2
                id="confirm-dialog-title"
                className="font-display text-base font-bold text-[#17231E]"
              >
                {title}
              </h2>
              <p
                id="confirm-dialog-desc"
                className="mt-1 text-xs leading-relaxed text-[#65736B]"
              >
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close confirmation dialog"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#65736B] hover:bg-[#F7F8F5] hover:text-[#17231E]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-[#E1E8E2] pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-lg border border-[#E1E8E2] bg-white px-3.5 text-xs font-medium text-[#17231E] hover:bg-[#F7F8F5]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`inline-flex h-9 items-center rounded-lg px-4 text-xs font-semibold text-white ${
              tone === 'danger'
                ? 'bg-[#B91C1C] hover:bg-[#991B1B]'
                : 'bg-[#174C3C] hover:bg-[#113A2E]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
