import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  message: string;
  tone?: 'success' | 'info' | 'warning';
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Workspace notifications"
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-2 pl-4 sm:right-6 sm:bottom-6 sm:pl-0"
    >
      {toasts.map((toast) => {
        const tone = toast.tone ?? 'success';
        const Icon =
          tone === 'warning'
            ? AlertTriangle
            : tone === 'info'
              ? Info
              : CheckCircle2;
        const containerTone =
          tone === 'warning'
            ? 'border-[#E6D1A5] bg-[#FDF9EE] text-[#7A4F00]'
            : tone === 'info'
              ? 'border-[#CBD7E6] bg-[#F3F6FA] text-[#1E3A5F]'
              : 'border-[#C6DCD0] bg-white text-[#17231E]';

        const iconTone =
          tone === 'warning'
            ? 'text-[#B45309]'
            : tone === 'info'
              ? 'text-[#2B4C73]'
              : 'text-[#287A5A]';

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start justify-between gap-3 rounded-xl border px-3.5 py-3 shadow-md ${containerTone}`}
          >
            <div className="flex items-start gap-2.5 text-xs font-medium leading-snug">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconTone}`} aria-hidden="true" />
              <span>{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#65736B] hover:bg-[#F5F7F5] hover:text-[#17231E]"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
