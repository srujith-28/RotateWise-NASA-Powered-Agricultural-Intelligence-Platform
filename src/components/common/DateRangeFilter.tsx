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
      <div className="flex flex-wrap items-center gap-1 rounded-xl bg-[#EEF1EE] p-1">
        {PRESETS.map((p) => {
          const active = value.preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => selectPreset(p.id)}
              aria-pressed={active}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
                active
                  ? 'bg-white text-[#18231E] shadow-[0_1px_2px_rgba(20,37,29,0.08)]'
                  : 'text-[#737D76] hover:text-[#18231E]'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-[#737D76]">
        <Calendar className="h-3.5 w-3.5 text-[#287A5A]" aria-hidden="true" />
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
          className="h-8 rounded-lg border border-[#E7EBE7] bg-white px-2 text-xs font-medium text-[#18231E] focus:border-[#174C3C] focus:outline-none"
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
          className="h-8 rounded-lg border border-[#E7EBE7] bg-white px-2 text-xs font-medium text-[#18231E] focus:border-[#174C3C] focus:outline-none"
        >
          {MONTH_LABELS.map((m, idx) => (
            <option key={m} value={idx}>
              {m}
            </option>
          ))}
        </select>

        <span className="font-mono text-[11px] text-[#737D76]">
          ({formatRangeLabel(value)})
        </span>
      </div>
    </div>
  );
}
