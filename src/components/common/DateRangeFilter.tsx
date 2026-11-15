import { Calendar } from 'lucide-react';
import {
  formatRangeLabel,
  getPresetMonthBounds,
  MONTH_LABELS,
  type ClimateDateRange,
  type ClimateRangePreset,
} from '../../lib/agronomy';

interface DateRangeFilterProps {
  value: ClimateDateRange;
  onChange: (next: ClimateDateRange) => void;
}

const PRESETS: Array<{ id: Exclude<ClimateRangePreset, 'custom'>; label: string }> = [
  { id: '12m', label: 'Full Year' },
  { id: 'growing', label: 'Growing (Apr–Oct)' },
  { id: '6m', label: 'Jul–Dec' },
  { id: 'spring', label: 'Jan–Jun' },
];

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const selectPreset = (preset: Exclude<ClimateRangePreset, 'custom'>) => {
    const bounds = getPresetMonthBounds(preset);
    onChange({
      preset,
      ...bounds,
    });
  };

  return (
    <div
      className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
      role="group"
      aria-label="Climate chart date range filter"
    >
      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-[#EAE8E0] p-1">
        {PRESETS.map((p) => {
          const active = value.preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => selectPreset(p.id)}
              aria-pressed={active}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'bg-white text-[#14221A] shadow-sm'
                  : 'text-[#4B5B51] hover:text-[#14221A]'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-[#4B5B51]">
        <Calendar className="h-3.5 w-3.5 text-[#2E8B57]" aria-hidden="true" />
        <label htmlFor="climate-start-month" className="sr-only">
          Start month
        </label>
        <select
          id="climate-start-month"
          aria-label="Filter start month"
          value={value.startMonthIndex}
          onChange={(e) => {
            const nextStart = Number(e.target.value);
            onChange({
              preset: 'custom',
              startMonthIndex: nextStart,
              endMonthIndex: Math.max(nextStart, value.endMonthIndex),
            });
          }}
          className="h-8 rounded-md border border-[#D8D5CB] bg-white px-2 text-xs font-medium text-[#14221A] focus:border-[#154734] focus:outline-none"
        >
          {MONTH_LABELS.map((m, idx) => (
            <option key={m} value={idx}>
              {m}
            </option>
          ))}
        </select>

        <span aria-hidden="true">to</span>

        <label htmlFor="climate-end-month" className="sr-only">
          End month
        </label>
        <select
          id="climate-end-month"
          aria-label="Filter end month"
          value={value.endMonthIndex}
          onChange={(e) => {
            const nextEnd = Number(e.target.value);
            onChange({
              preset: 'custom',
              startMonthIndex: Math.min(value.startMonthIndex, nextEnd),
              endMonthIndex: nextEnd,
            });
          }}
          className="h-8 rounded-md border border-[#D8D5CB] bg-white px-2 text-xs font-medium text-[#14221A] focus:border-[#154734] focus:outline-none"
        >
          {MONTH_LABELS.map((m, idx) => (
            <option key={m} value={idx}>
              {m}
            </option>
          ))}
        </select>

        <span className="font-mono text-[11px] text-[#6B7970]">
          ({formatRangeLabel(value)})
        </span>
      </div>
    </div>
  );
}
