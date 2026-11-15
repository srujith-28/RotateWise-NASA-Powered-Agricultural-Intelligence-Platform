import { AlertTriangle, RefreshCw, Sprout } from 'lucide-react';

export function DashboardLoadingSkeleton() {
  return (
    <div className="space-y-8" role="status" aria-label="Loading farm analytics">
      <div className="flex items-end justify-between border-b border-[#E7EBE7] pb-6">
        <div className="space-y-2.5">
          <div className="h-3.5 w-32 animate-pulse rounded bg-[#E7EBE7]" />
          <div className="h-9 w-72 animate-pulse rounded-lg bg-[#E7EBE7]" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded bg-[#EFF2EE]" />
        </div>
        <div className="hidden gap-2.5 sm:flex">
          <div className="h-10 w-36 animate-pulse rounded-xl bg-[#E7EBE7]" />
          <div className="h-10 w-36 animate-pulse rounded-xl bg-[#DCE8E0]" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="h-72 animate-pulse rounded-2xl bg-[#14251D]/90 lg:col-span-5" />
        <div className="h-72 animate-pulse rounded-2xl border border-[#E7EBE7] bg-white lg:col-span-7" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {[1, 2].map((idx) => (
          <div
            key={idx}
            className="h-72 rounded-2xl border border-[#E7EBE7] bg-white p-6"
          >
            <div className="h-4 w-44 animate-pulse rounded bg-[#E7EBE7]" />
            <div className="mt-2 h-3 w-64 animate-pulse rounded bg-[#EFF2EE]" />
            <div className="mt-6 h-48 animate-pulse rounded-xl bg-[#F7F8F6]" />
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
    <div className="rounded-2xl border border-[#E7EBE7] bg-white p-12 text-center">
      <Sprout className="mx-auto h-9 w-9 text-[#287A5A]" aria-hidden="true" />
      <h2 className="mt-4 font-display text-lg font-semibold tracking-[-0.015em] text-[#18231E]">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#737D76]">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-[#174C3C] px-5 text-sm font-medium text-white transition-colors hover:bg-[#133F32]"
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
      className="flex flex-col gap-3 rounded-2xl border border-[#EBC4C4] bg-[#FEF4F4] px-4 py-3.5 text-xs text-[#991B1B] sm:flex-row sm:items-center sm:justify-between"
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
            className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#DC2626]/25 bg-white px-3 text-xs font-medium text-[#991B1B] hover:bg-[#FEE2E2]"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Retry</span>
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-8 items-center rounded-xl px-2.5 text-xs font-medium text-[#991B1B] hover:bg-[#FEE2E2]"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
