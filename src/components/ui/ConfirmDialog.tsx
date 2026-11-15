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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#14251D]/40 p-4 backdrop-blur-[2px]"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#E7EBE7] bg-white p-6 shadow-[0_20px_50px_rgba(20,37,29,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
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
                className="font-display text-base font-semibold tracking-[-0.01em] text-[#18231E]"
              >
                {title}
              </h2>
              <p
                id="confirm-dialog-desc"
                className="mt-1.5 text-[13px] leading-relaxed text-[#737D76]"
              >
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close confirmation dialog"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[#737D76] transition-colors hover:bg-[#F7F8F6] hover:text-[#18231E]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5 border-t border-[#E7EBE7] pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-xl border border-[#E7EBE7] bg-white px-4 text-xs font-medium text-[#18231E] transition-colors hover:bg-[#F7F8F6]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`inline-flex h-9 items-center rounded-xl px-4 text-xs font-semibold text-white transition-colors ${
              tone === 'danger'
                ? 'bg-[#B91C1C] hover:bg-[#991B1B]'
                : 'bg-[#174C3C] hover:bg-[#133F32]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
