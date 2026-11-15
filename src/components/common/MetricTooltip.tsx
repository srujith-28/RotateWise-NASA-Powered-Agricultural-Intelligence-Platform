import { HelpCircle } from 'lucide-react';
import { useId, useState } from 'react';

interface MetricTooltipProps {
  label: string;
  description: string;
}

export function MetricTooltip({ label, description }: MetricTooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={`Explain ${label}`}
        aria-describedby={open ? tooltipId : undefined}
        className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-[#737D76] transition-colors hover:bg-[#EAF2EC]/70 hover:text-[#174C3C] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#174C3C]"
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-40 mb-2 w-60 -translate-x-1/2 rounded-xl border border-[#23382D] bg-[#14251D] px-3.5 py-2.5 text-left text-[11px] font-normal leading-relaxed text-[#E7EBE7] shadow-[0_12px_28px_rgba(20,37,29,0.28)]"
        >
          <span className="block font-semibold text-white">{label}</span>
          <span className="mt-1 block text-[#BFD0C5]">{description}</span>
        </span>
      )}
    </span>
  );
}
