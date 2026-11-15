import type { ReactNode } from 'react';
import {
  DataClassificationBadge,
  type EpistemicCategory,
} from './DataClassificationBadge';

interface PageHeaderProps {
  breadcrumb?: string;
  title: string;
  subtitle: string;
  metadata?: ReactNode;
  classification?: EpistemicCategory;
  actions?: ReactNode;
}

export function PageHeader({
  breadcrumb,
  title,
  subtitle,
  metadata,
  classification,
  actions,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-[#E7EBE7] pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {breadcrumb && (
          <p className="text-xs font-medium text-[#737D76]">
            RotateWise <span className="mx-1 text-[#C5CEC7]">/</span> {breadcrumb}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[26px] leading-[1.14] font-semibold tracking-[-0.025em] text-[#18231E] sm:text-[32px]">
            {title}
          </h1>
          {classification && <DataClassificationBadge category={classification} />}
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#737D76] sm:text-[15px]">
          {subtitle}
        </p>
        {metadata && (
          <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#737D76]">
            {metadata}
          </div>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>
      )}
    </header>
  );
}
