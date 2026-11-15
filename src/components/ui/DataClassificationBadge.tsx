import {
  AlertCircle,
  Calculator,
  CalendarRange,
  Database,
  Satellite,
  SlidersHorizontal,
} from 'lucide-react';

export type EpistemicCategory =
  | 'nasa'
  | 'suitability'
  | 'rotation'
  | 'scenario'
  | 'demo'
  | 'insufficient';

interface DataClassificationBadgeProps {
  category: EpistemicCategory;
  customLabel?: string;
}

const BADGE_META: Record<
  EpistemicCategory,
  {
    label: string;
    icon: typeof Satellite;
    classes: string;
  }
> = {
  nasa: {
    label: 'NASA Historical Observation',
    icon: Satellite,
    classes: 'border-[#C6DCD0] bg-[#EAF2EC] text-[#174C3C]',
  },
  suitability: {
    label: 'Calculated Suitability',
    icon: Calculator,
    classes: 'border-[#D1DFD6] bg-[#F5F9F6] text-[#1F5642]',
  },
  rotation: {
    label: 'Rotation Assessment',
    icon: CalendarRange,
    classes: 'border-[#D5E1D9] bg-[#F7F8F5] text-[#174C3C]',
  },
  scenario: {
    label: 'Hypothetical Scenario',
    icon: SlidersHorizontal,
    classes: 'border-[#E6D1A5] bg-[#FDF9EE] text-[#8A5A00]',
  },
  demo: {
    label: 'Demonstration Data',
    icon: Database,
    classes: 'border-[#CBD7E6] bg-[#F3F6FA] text-[#2B4C73]',
  },
  insufficient: {
    label: 'Insufficient Data',
    icon: AlertCircle,
    classes: 'border-[#EBC4C4] bg-[#FEF3F3] text-[#991B1B]',
  },
};

export function DataClassificationBadge({
  category,
  customLabel,
}: DataClassificationBadgeProps) {
  const meta = BADGE_META[category];
  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-tight whitespace-nowrap ${meta.classes}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{customLabel ?? meta.label}</span>
    </span>
  );
}
