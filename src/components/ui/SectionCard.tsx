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
      className={`rounded-2xl border border-[#E7EBE7] bg-white p-5 sm:p-6 ${className}`}
    >
      {(title || headerAction) && (
        <div className="mb-5 flex flex-col gap-2 border-b border-[#E7EBE7] pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              {title && (
                <h2 className="flex items-center gap-1.5 font-display text-[17px] font-semibold tracking-[-0.015em] text-[#18231E]">
                  <span>{title}</span>
                  {tooltip && <MetricTooltip label={title} description={tooltip} />}
                </h2>
              )}
              {classification && <DataClassificationBadge category={classification} />}
            </div>
            {subtitle && (
              <p className="mt-1 text-[13px] leading-relaxed text-[#737D76]">{subtitle}</p>
            )}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
