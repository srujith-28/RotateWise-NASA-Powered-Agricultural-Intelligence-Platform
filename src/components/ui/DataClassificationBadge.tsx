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
    classes: 'bg-[#EAF2EC]/80 text-[#174C3C]',
  },
  suitability: {
    label: 'Calculated Suitability',
    icon: Calculator,
    classes: 'bg-[#F0F4F1] text-[#287A5A]',
  },
  rotation: {
    label: 'Rotation Assessment',
    icon: CalendarRange,
    classes: 'bg-[#F0F4F1] text-[#174C3C]',
  },
  scenario: {
    label: 'Hypothetical Scenario',
    icon: SlidersHorizontal,
    classes: 'bg-[#FDF6E7] text-[#8A5A00]',
  },
  demo: {
    label: 'Demonstration Data',
    icon: Database,
    classes: 'bg-[#EEF2F7] text-[#35557A]',
  },
  insufficient: {
    label: 'Insufficient Data',
    icon: AlertCircle,
    classes: 'bg-[#FCEEEE] text-[#991B1B]',
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
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium tracking-tight whitespace-nowrap ${meta.classes}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{customLabel ?? meta.label}</span>
    </span>
  );
}
