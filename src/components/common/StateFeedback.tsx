import { AlertTriangle, RefreshCw, Sprout } from 'lucide-react';

export function DashboardLoadingSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading farm analytics">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-60 animate-pulse rounded-md bg-[#E1E8E2]" />
          <div className="h-4 w-80 animate-pulse rounded-md bg-[#EAF0EB]" />
        </div>
        <div className="hidden gap-2 sm:flex">
          <div className="h-10 w-40 animate-pulse rounded-lg bg-[#E1E8E2]" />
          <div className="h-10 w-36 animate-pulse rounded-lg bg-[#D3E2D8]" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((idx) => (
          <div
            key={idx}
            className="h-[116px] rounded-xl border border-[#E1E8E2] bg-white p-5"
          >
            <div className="h-3.5 w-28 animate-pulse rounded bg-[#EAF0EB]" />
            <div className="mt-3 h-7 w-24 animate-pulse rounded bg-[#E1E8E2]" />
            <div className="mt-2 h-3 w-40 animate-pulse rounded bg-[#EAF0EB]" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {[1, 2].map((idx) => (
          <div
            key={idx}
            className="h-[340px] rounded-xl border border-[#E1E8E2] bg-white p-5"
          >
            <div className="h-4 w-44 animate-pulse rounded bg-[#E1E8E2]" />
            <div className="mt-2 h-3 w-64 animate-pulse rounded bg-[#EAF0EB]" />
            <div className="mt-6 h-56 animate-pulse rounded-lg bg-[#F7F8F5]" />
          </div>
        ))}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-[#E1E8E2] bg-white p-10 text-center">
      <Sprout className="mx-auto h-10 w-10 text-[#287A5A]" aria-hidden="true" />
      <h2 className="mt-4 font-display text-lg font-semibold text-[#17231E]">
        {title}
      </h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-[#65736B]">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-[#174C3C] px-5 text-sm font-medium text-white hover:bg-[#113A2E]"
        >
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
}

interface ErrorBannerProps {
  title: string;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorBanner({
  title,
  message,
  onRetry,
  onDismiss,
}: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border border-[#EBC4C4] bg-[#FEF3F3] px-4 py-3 text-xs text-[#991B1B] sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0 text-[#B91C1C]"
          aria-hidden="true"
        />
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-0.5 text-[#7F1D1D]">{message}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#DC2626]/30 bg-white px-3 text-xs font-medium text-[#991B1B] hover:bg-[#FEE2E2]"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Retry</span>
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-[#991B1B] hover:bg-[#FEE2E2]"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
