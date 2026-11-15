import type { LucideIcon } from 'lucide-react';
import { MetricTooltip } from './MetricTooltip';

interface KpiCardProps {
  label: string;
  value: string;
  suffix?: string;
  subtitle?: string;
  subtitleTone?: 'neutral' | 'positive' | 'warning' | 'danger';
  valueTone?: 'default' | 'primary' | 'danger';
  icon?: LucideIcon;
  tooltip?: string;
}

export function KpiCard({
  label,
  value,
  suffix,
  subtitle,
  subtitleTone = 'neutral',
  valueTone = 'default',
  icon: Icon,
  tooltip,
}: KpiCardProps) {
  const subtitleColor =
    subtitleTone === 'positive'
      ? 'font-medium text-[#174C3C]'
      : subtitleTone === 'warning'
        ? 'font-medium text-[#9A5B00]'
        : subtitleTone === 'danger'
          ? 'font-medium text-[#B91C1C]'
          : 'text-[#65736B]';

  const valueColor =
    valueTone === 'primary'
      ? 'text-[#174C3C]'
      : valueTone === 'danger'
        ? 'text-[#B91C1C]'
        : 'text-[#17231E]';

  return (
    <div className="rounded-xl border border-[#E1E8E2] bg-white p-5">
      <div className="flex items-center justify-between gap-2 text-xs font-medium text-[#65736B]">
        <span className="flex items-center gap-1">
          <span>{label}</span>
          {tooltip && <MetricTooltip label={label} description={tooltip} />}
        </span>
        {Icon && (
          <Icon className="h-4 w-4 shrink-0 text-[#287A5A]" aria-hidden="true" />
        )}
      </div>
      <p className={`mt-2 font-display text-2xl font-bold tabular-nums ${valueColor}`}>
        {value}
        {suffix && (
          <span className="text-sm font-normal text-[#65736B]">{suffix}</span>
        )}
      </p>
      {subtitle && <p className={`mt-1 text-xs ${subtitleColor}`}>{subtitle}</p>}
    </div>
  );
}
