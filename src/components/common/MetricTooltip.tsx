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
        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[#728077] hover:bg-[#F2F6F3] hover:text-[#154734] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#154734]"
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-40 mb-2 w-60 -translate-x-1/2 rounded-lg border border-[#D8D5CB] bg-[#14221A] px-3 py-2 text-left text-[11px] font-normal leading-relaxed text-[#F2F6F3] shadow-lg"
        >
          <span className="block font-semibold text-white">{label}</span>
          <span className="mt-0.5 block text-[#D3E2D8]">{description}</span>
        </span>
      )}
    </span>
  );
}
