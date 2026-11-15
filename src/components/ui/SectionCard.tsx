import type { ReactNode } from 'react';
import { MetricTooltip } from '../common/MetricTooltip';
import {
  DataClassificationBadge,
  type EpistemicCategory,
} from './DataClassificationBadge';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  tooltip?: string;
  classification?: EpistemicCategory;
  headerAction?: ReactNode;
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
}

export function SectionCard({
  title,
  subtitle,
  tooltip,
  classification,
  headerAction,
  ariaLabel,
  children,
  className = '',
}: SectionCardProps) {
  return (
    <section
      aria-label={ariaLabel ?? title}
      className={`rounded-xl border border-[#E1E8E2] bg-white p-5 ${className}`}
    >
      {(title || headerAction) && (
        <div className="mb-4 flex flex-col gap-2 border-b border-[#E1E8E2] pb-3.5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {title && (
                <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-[#17231E]">
                  <span>{title}</span>
                  {tooltip && <MetricTooltip label={title} description={tooltip} />}
                </h2>
              )}
              {classification && <DataClassificationBadge category={classification} />}
            </div>
            {subtitle && (
              <p className="mt-0.5 text-xs text-[#65736B]">{subtitle}</p>
            )}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
