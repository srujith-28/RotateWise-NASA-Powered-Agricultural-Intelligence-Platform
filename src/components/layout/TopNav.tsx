import { MapPin, Menu, Plus, Satellite, Settings } from 'lucide-react';
import type { UseNasaPowerClimateResult } from '../../hooks/useNasaPowerClimate';
import type { Farm, NavSection } from '../../types/rotatewise';

interface TopNavProps {
  farms: Farm[];
  activeFarm: Farm | null;
  onSelectFarm: (farmId: string) => void;
  onOpenAddFarm: () => void;
  onOpenMobileNav: () => void;
  nasaStatus: UseNasaPowerClimateResult['status'];
  unitSystem: 'imperial' | 'metric';
  onNavigate: (section: NavSection) => void;
}

export function TopNav({
  farms,
  activeFarm,
  onSelectFarm,
  onOpenAddFarm,
  onOpenMobileNav,
  nasaStatus,
  unitSystem,
  onNavigate,
}: TopNavProps) {
  const nasaStatusText =
    nasaStatus === 'success'
      ? 'NASA POWER Live'
      : nasaStatus === 'loading'
        ? 'Syncing NASA POWER...'
        : nasaStatus === 'error'
          ? 'NASA POWER Unavailable'
          : 'NASA POWER Idle';

  const nasaStatusDot =
    nasaStatus === 'success'
      ? 'bg-[#287A5A]'
      : nasaStatus === 'loading'
        ? 'bg-[#C27803]'
        : nasaStatus === 'error'
          ? 'bg-[#B91C1C]'
          : 'bg-[#737D76]';

  return (
    <header className="sticky top-0 z-30 border-b border-[#E7EBE7] bg-[#F7F8F6]/90 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between gap-2 px-3 sm:h-16 sm:gap-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onOpenMobileNav}
            aria-label="Open navigation menu"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#E7EBE7] bg-white text-[#18231E] transition-colors hover:bg-[#EEF2EE] lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:flex-initial">
            <label htmlFor="active-farm-selector" className="sr-only">
              Select Active Farm
            </label>
            <select
              id="active-farm-selector"
              aria-label="Active farm selector"
              value={activeFarm?.id ?? ''}
              onChange={(e) => onSelectFarm(e.target.value)}
              disabled={farms.length === 0}
              className="h-9 w-full min-w-0 truncate rounded-xl border border-[#E7EBE7] bg-white px-3 text-sm font-medium text-[#18231E] transition-colors focus:border-[#174C3C] focus:outline-none sm:w-auto sm:max-w-[230px]"
            >
              {farms.length === 0 ? (
                <option value="">No farms configured</option>
              ) : (
                farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.name}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              onClick={onOpenAddFarm}
              aria-label="Add new farm"
              title="Add new farm"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#E7EBE7] bg-white text-[#174C3C] transition-colors hover:bg-[#EAF2EC]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {activeFarm && (
            <div className="hidden min-w-0 items-center gap-2 text-xs text-[#737D76] md:flex whitespace-nowrap">
              <MapPin
                className="h-3.5 w-3.5 shrink-0 text-[#287A5A]"
                aria-hidden="true"
              />
              <span className="max-w-[190px] truncate font-medium text-[#18231E] xl:max-w-[260px]">
                {activeFarm.location}
              </span>
              <span className="text-[#C5CEC7]" aria-hidden="true">·</span>
              <span className="shrink-0 font-mono tabular-nums">
                {activeFarm.coordinates.lat.toFixed(2)}°,{' '}
                {activeFarm.coordinates.lng.toFixed(2)}°
              </span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('climate')}
            title="View NASA POWER climate telemetry"
            className="hidden items-center gap-2 rounded-xl border border-[#E7EBE7] bg-white px-3 py-1.5 text-xs font-medium text-[#18231E] transition-colors hover:bg-[#EAF2EC]/60 sm:inline-flex whitespace-nowrap"
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${nasaStatusDot}`}
              aria-hidden="true"
            />
            <Satellite className="h-3.5 w-3.5 text-[#174C3C]" aria-hidden="true" />
            <span>{nasaStatusText}</span>
          </button>

          <span className="hidden items-center rounded-xl border border-[#E7EBE7] bg-white px-2.5 py-1.5 font-mono text-[11px] font-medium text-[#737D76] xl:inline-flex whitespace-nowrap">
            {unitSystem === 'imperial' ? 'ac · °F · in' : 'ha · °C · mm'}
          </span>

          <button
            type="button"
            onClick={() => onNavigate('settings')}
            aria-label="Open workspace and unit settings"
            title="Workspace & unit settings"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E7EBE7] bg-white text-[#737D76] transition-colors hover:bg-[#EEF2EE] hover:text-[#18231E]"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
