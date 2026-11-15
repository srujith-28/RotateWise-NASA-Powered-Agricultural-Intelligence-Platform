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
    <div className="flex flex-col gap-3 border-b border-[#E1E8E2] pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {breadcrumb && (
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#65736B]">
            RotateWise / {breadcrumb}
          </p>
        )}
        <div className="mt-0.5 flex flex-wrap items-center gap-2.5">
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#17231E]">
            {title}
          </h1>
          {classification && <DataClassificationBadge category={classification} />}
        </div>
        <p className="mt-1 max-w-3xl text-sm text-[#65736B]">{subtitle}</p>
        {metadata && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#65736B]">
            {metadata}
          </div>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
